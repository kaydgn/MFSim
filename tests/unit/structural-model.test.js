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

const ROOT = path.join(__dirname, '../..');
const WASM = new Uint8Array(fs.readFileSync(path.join(ROOT, 'vendor/occt-import-js.wasm')));
const stepBytes = (name) =>
  new Uint8Array(fs.readFileSync(path.join(ROOT, 'tests/fixtures/step', name)));

// OCCT yüklemesi (7.3 MB WASM derlemesi) pahalı → suite başına BİR kez.
const imp = (name, deflection) =>
  model.veStrImportStep(stepBytes(name), { fileName: name, fileSize: 123, deflection }, { wasmBinary: WASM });

let cube, rounded;
beforeAll(async () => {
  cube = await imp('cube-mm.step');
  rounded = await imp('rounded-cube.step');
}, 120000);

// Derlenmiş WASM örneği (7.3 MB) suite sonunda BIRAKILMALI: tutulursa jest
// worker'ı teardown'da zorla kapatılıyor ("failed to exit gracefully").
afterAll(() => {
  model.veStrOcctForget();
  model.veStrGeomCacheClear();
  cube = null; rounded = null;
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
    expect(rec.faces[0]).toEqual({ id: 'm0/f0', meshName: 'Cube', triCount: 2 });
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

  test('success:false → okunamadı; boş mesh listesi → AYRI sebep', () => {
    const a = model.veStrNormalizeImport({ success: false }, {});
    const b = model.veStrNormalizeImport({ success: true, meshes: [] }, {});
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

// ── 8) WASM yolu — tek dosya sürümü sessizce kırılmasın ───────────────────
describe('WASM yükleyici sözleşmesi', () => {
  test('aday yollar arasında vendor/ var ve sıralı denenir', () => {
    expect(model.VE_STR_OCCT_WASM_PATHS[0]).toBe('vendor/occt-import-js.wasm');
    expect(model.VE_STR_OCCT_WASM_PATHS.length).toBeGreaterThan(1);
  });

  test('hiçbir aday yol tutmazsa REDDEDİYOR ve DENENEN YOLLARI yazıyor', async () => {
    // Sessizce boş geometri dönmek en kötüsü olurdu: kullanıcı "parça gelmedi"
    // görür, sebebini (dosya yanlış yerde) asla öğrenemez.
    // jsdom'da fetch yok → aday-yol aramasını sınamak için sahte fetch.
    const cagrilan = [];
    global.fetch = (u) => { cagrilan.push(u); return Promise.reject(new Error('404')); };
    try {
      const r = await model.veStrImportStep(
        new Uint8Array([0]),
        {},
        { force: true, wasmUrls: ['yok-1.wasm', 'yok-2.wasm'] }
      );
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/bulunamadı/i);
      // Yollar SIRAYLA denendi ve hepsi mesajda yazılı
      expect(cagrilan).toEqual(['yok-1.wasm', 'yok-2.wasm']);
      expect(r.error).toContain('yok-1.wasm');
      expect(r.error).toContain('yok-2.wasm');
    } finally { delete global.fetch; }
  }, 60000);

  test('ilk tutan yol kazanır — kalanlar denenmez', async () => {
    const cagrilan = [];
    global.fetch = (u) => {
      cagrilan.push(u);
      if (u === 'ikinci.wasm') return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(WASM) });
      return Promise.reject(new Error('404'));
    };
    try {
      const r = await model.veStrImportStep(
        stepBytes('cube-mm.step'),
        { fileName: 'cube-mm.step' },
        { force: true, wasmUrls: ['birinci.wasm', 'ikinci.wasm', 'ucuncu.wasm'] }
      );
      expect(r.ok).toBe(true);
      expect(cagrilan).toEqual(['birinci.wasm', 'ikinci.wasm']);   // üçüncüye hiç gidilmedi
      expect(r.wasmUrl).toBe('ikinci.wasm');                       // hangi yolun tuttuğu künyede
    } finally { delete global.fetch; }
  }, 120000);
});

// ── 9) Okuyucunun kendi teşhisi kullanıcıya ULAŞIYOR ──────────────────────
describe('OCCT teşhisi hata mesajına iliştiriliyor', () => {
  test('bozuk STEP: genel cümlenin yanında okuyucunun satırı da var', async () => {
    // OCCT "Line 2: Incorrect syntax: unexpected QUID, expecting STEP" gibi
    // TAM SEBEBİ yazıyor ama varsayılanda bu console'a düşer ve kullanıcı
    // yalnız "dosya okunamadı" görür. Teşhis olmadan kullanıcı dosyanın mı
    // yoksa programın mı sorunlu olduğunu ayırt edemez.
    const bozuk = new Uint8Array(Buffer.from('ISO-10303-21;\nHEADER_BOZUK;\n', 'utf8'));
    const r = await model.veStrImportStep(bozuk, { fileName: 'bozuk.step' }, { wasmBinary: WASM });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/teşhisi/);
    expect(r.error).toMatch(/syntax|STEP|Line/i);
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

  test('sonuç TİPLİ dizi olarak ve TRANSFER ile dönüyor', () => {
    // Düz JS dizisi kopyalanarak geçerdi; 45 bin üçgende bu ikinci bir maliyet.
    expect(src).toContain('Float32Array');
    expect(src).toContain('Uint32Array');
    expect(src).toMatch(/postMessage\(\s*\{[^}]*type:"result"[\s\S]*?\},\s*transfer\s*\)/);
  });

  test('brep_faces worker\'dan AYNEN geçiyor — yüz kimliği worker\'da kaybolmaz', () => {
    expect(src).toContain('brep_faces');
  });
});

describe('worker sonucu ana iş parçacığında normalize ediliyor', () => {
  // Worker mesh'i occt'nin `attributes.position.array` biçiminde DEĞİL,
  // tipli `positions`/`indices` alanlarıyla gönderiyor. veStrNormalizeImport
  // ikisini de kabul etmeli — yoksa worker yolu boş geometri üretirdi.
  const workerRaw = {
    success: true,
    meshes: [{
      name: 'Braket',
      color: null,
      brep_faces: [{ first: 0, last: 0, color: null }, { first: 1, last: 1, color: null }],
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]),
      normals: null,
      indices: new Uint32Array([0, 1, 2, 0, 1, 3]),
    }],
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
    expect(g.meshes[0].positions).toBe(workerRaw.meshes[0].positions);
    expect(g.meshes[0].indices).toBe(workerRaw.meshes[0].indices);
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
describe('ilerleme bildirimi', () => {
  test('aşama adları sabit', () => {
    expect(model.VE_STR_STAGES).toEqual(['reader', 'download', 'parse', 'build']);
  });

  // BU KAPI GERÇEK BİR ÖLÇÜMDEN DOĞDU: hem `npx serve` hem GitHub Pages
  // .wasm'ı `content-encoding: br` + `chunked` ile gönderiyor → tarayıcıda
  // `content-length` HİÇ GELMİYOR. Yüzde bu yüzden bilinen dosya boyutundan
  // hesaplanıyor; sabit dosyayla birlikte kaymamalı.
  test('VE_STR_OCCT_WASM_BYTES gerçek dosya boyutuna EŞİT', () => {
    const st = fs.statSync(path.join(ROOT, 'vendor/occt-import-js.wasm'));
    expect(model.VE_STR_OCCT_WASM_BYTES).toBe(st.size);
  });

  test('indirme aşaması loaded/total/pct bildiriyor', async () => {
    const parcalar = [new Uint8Array(400), new Uint8Array(600)];
    let i = 0;
    global.fetch = () => Promise.resolve({
      ok: true,
      headers: { get: () => null },                       // br/chunked: başlık YOK
      body: { getReader: () => ({ read: () => Promise.resolve(
        i < parcalar.length ? { done: false, value: parcalar[i++] } : { done: true }) }) },
    });
    const gorulen = [];
    try {
      await model.veStrImportStep(new Uint8Array([0]), {}, {
        force: true, wasmUrls: ['x.wasm'], expectedBytes: 1000, noWorker: true,
        onProgress: (s, info) => gorulen.push({ s: s, pct: info && info.pct, loaded: info && info.loaded }),
      });
    } finally { delete global.fetch; }

    const ind = gorulen.filter((g) => g.s === 'download');
    expect(ind.length).toBe(2);
    expect(ind[0]).toEqual({ s: 'download', loaded: 400, pct: 0.4 });
    expect(ind[1]).toEqual({ s: 'download', loaded: 1000, pct: 1 });
    // İndirmeden sonra okuyucu hazırlama aşaması da bildiriliyor
    expect(gorulen.map((g) => g.s)).toContain('reader');
  }, 60000);

  test('tahmin tutmazsa yüzde GÖSTERİLMİYOR — %140 yazan çubuk olmaz', async () => {
    let i = 0;
    const parcalar = [new Uint8Array(5000)];
    global.fetch = () => Promise.resolve({
      ok: true,
      headers: { get: () => null },
      body: { getReader: () => ({ read: () => Promise.resolve(
        i < parcalar.length ? { done: false, value: parcalar[i++] } : { done: true }) }) },
    });
    const gorulen = [];
    try {
      await model.veStrImportStep(new Uint8Array([0]), {}, {
        force: true, wasmUrls: ['x.wasm'], expectedBytes: 1000, noWorker: true,
        onProgress: (s, info) => { if (s === 'download') gorulen.push(info.pct); },
      });
    } finally { delete global.fetch; }
    expect(gorulen).toEqual([null]);
  }, 60000);
});

// ── 12) GÖMÜLÜ OKUYUCU — ÇEVRİMDIŞI ÇALIŞMANIN ŞARTI ──────────────────────
// .wasm artık uygulamanın içinde (js/structural-occt-wasm.js). Eskiden
// `vendor/` yolundan indiriliyordu ve yanında vendor/ olmayan bir kurulumda
// STEP hiç açılmıyordu. Gerçek tarayıcıdaki uçtan uca kapı
// tests/e2e/structural-geometry.spec.js'te (ağ kesikken içe aktarma).
describe('gömülü .wasm varlığı', () => {
  const ASSET = path.join(ROOT, 'js/structural-occt-wasm.js');

  test('varlık üretilmiş ve depoda', () => {
    expect(fs.existsSync(ASSET)).toBe(true);
  });

  // EN ÖNEMLİ KAPI: vendor .wasm güncellenip varlık yeniden üretilmezse
  // program SESSİZCE ESKİ okuyucuyu taşır. Bayt bayt karşılaştırılıyor.
  test('gömülü içerik vendor/occt-import-js.wasm ile BİREBİR aynı', () => {
    const src = fs.readFileSync(ASSET, 'utf8');
    const m = src.match(/VE_STR_OCCT_WASM_GZ_B64 = "([A-Za-z0-9+/=]+)"/);
    expect(m).not.toBeNull();
    const acilmis = zlib.gunzipSync(Buffer.from(m[1], 'base64'));
    const vendor = fs.readFileSync(path.join(ROOT, 'vendor/occt-import-js.wasm'));
    expect(acilmis.length).toBe(vendor.length);
    expect(acilmis.equals(vendor)).toBe(true);
    // WebAssembly imzası ("\0asm") — yanlış dosya gömülürse burada düşer.
    expect(Array.from(acilmis.slice(0, 4))).toEqual([0x00, 0x61, 0x73, 0x6d]);
  });

  test('varlık, ham base64\'ten belirgin biçimde KÜÇÜK (gzip gerçekten işe yarıyor)', () => {
    const boyut = fs.statSync(ASSET).size;
    const ham = fs.statSync(path.join(ROOT, 'vendor/occt-import-js.wasm')).size;
    // Ham base64 ~%133 olurdu; gzip+base64 yarısının altında olmalı.
    expect(boyut).toBeLessThan(ham * 0.66);
  });

  test('bildirilen açılmış boyut gerçek dosyayla tutuyor', () => {
    const src = fs.readFileSync(ASSET, 'utf8');
    const m = src.match(/VE_STR_OCCT_WASM_BYTES_EMBEDDED = (\d+);/);
    expect(m).not.toBeNull();
    expect(Number(m[1])).toBe(fs.statSync(path.join(ROOT, 'vendor/occt-import-js.wasm')).size);
  });

  test('index.html: varlık AÇILIŞTA yüklenmiyor, glue metni işaretli', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    // type="text/x-mfsim-asset" → ne tarayıcı ne MFSimLoader çalıştırır.
    expect(html).toMatch(/type="text\/x-mfsim-asset"[^>]*data-mfsim-asset="occt-wasm"[^>]*src="js\/structural-occt-wasm\.js"/);
    // Worker glue'yu AĞSIZ okuyabilsin diye vendor script'i işaretli.
    expect(html).toContain('data-mfsim-occt-glue');
    // Varlık `x-mfsim-defer` OLMAMALI — olsaydı 4 MB açılışta yüklenirdi.
    expect(html).not.toMatch(/x-mfsim-defer[^>]*structural-occt-wasm/);
  });

  test('worker köprüsü gzip açmayı KENDİSİ yapıyor (ana iş parçacığı durmasın)', () => {
    expect(model.VE_STR_WORKER_BRIDGE).toContain('DecompressionStream');
    expect(model.VE_STR_WORKER_BRIDGE).toContain('atob');
    expect(model.VE_STR_WORKER_BRIDGE).toContain('wasmB64');
  });
});
