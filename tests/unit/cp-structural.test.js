/**
 * cp-structural.test.js — YAPISAL ANALİZ modül iskeleti (js/cp-structural.js)
 *
 * Bu dosya modülün SÖZLEŞMESİNİ tutuyor, içeriğini değil: bileşen panelleri
 * bilerek boş (ayrı oturumlarda doldurulacak), dolayısıyla burada alan alan
 * assertion YOK — CLAUDE.md test politikası: panel başına tek smoke testi.
 *
 * Asıl değer üç yapısal kapıda:
 *   1) ZİNCİR PORTLARLA ZORLANIYOR. Geometri'nin girişi, Sonuçlar'ın çıkışı
 *      yok → kullanıcı analiz zincirini ters kuramaz. Bu bir YORUM değil,
 *      tip tanımındaki sayı; sessizce değiştirilirse zincir ters kurulabilir
 *      hale gelir ve bunu hiçbir davranış testi görmez.
 *   2) İSKELET DÖRT YERE BAĞLI. Modül kartı beş dosyada birden kablolanıyor
 *      (components / cp-core / ui-core / topology / index.html). Biri
 *      unutulursa modül "çalışıyor gibi" durur ama örneğin kaydetmeden önce
 *      köke çökmez → kaydedilen proje BOZUK olur (topology.js'teki uzun
 *      yorumun anlattığı hata sınıfı). Kapı beşini de arıyor.
 *   3) BAŞLANGIÇ ZİNCİRİ TİPLE YAZILI. Kenar tablosu indisle değil tiple
 *      tanımlı; yerleşim yeniden sıralanırsa indisli bir tablo sessizce
 *      yanlış bağlardı.
 */
const str = require('../../js/cp-structural.js');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));

beforeEach(() => {
  resetStubs(stubs);
  global.nodes = [];
  global.connections = [];
});

// ── 1) Modül kartı, diğer üç modülle AYNI sözleşme ──────────────────────────
describe('structural-analysis — alt-sistem sözleşmesi', () => {
  const def = () => componentDefs['structural-analysis'];

  test('isSubsystem taşır → veIsModuleNode onu modül sayar', () => {
    expect(def().isSubsystem).toBe(true);
    expect(veIsModuleNode({ type: 'structural-analysis' })).toBe(true);
  });

  test('kart ölçüsü tek kaynaktan (VE_MODULE_CARD_W/H)', () => {
    expect(def().defaultWidth).toBe(VE_MODULE_CARD_W);
    expect(def().defaultHeight).toBe(VE_MODULE_CARD_H);
    expect(veNodeDefaultSize('structural-analysis')).toEqual({ w: VE_MODULE_CARD_W, h: VE_MODULE_CARD_H });
  });

  test('modül kartının portu YOK — kanvasta bağlanmaz, çift tıkla açılır', () => {
    expect(def().inputs).toBe(0);
    expect(def().outputs).toBe(0);
    expect(def().isStrModule).toBe(true);
  });

  test('VE_MODULES bileşen listesinde modül ve dört zincir bileşeni var', () => {
    const list = VE_MODULES['full-throttle'].components;
    ['structural-analysis', 'str-geometry', 'str-mesh', 'str-bc', 'str-results']
      .forEach((t) => expect(list).toContain(t));
  });
});

// ── 2) ZİNCİR — port sayıları yapısal kapı ──────────────────────────────────
describe('analiz zinciri porttan okunuyor: Geometri → Ağ → Sınır Koşulları → Sonuçlar', () => {
  test('Geometri zincirin BAŞI — girişi yok', () => {
    expect(componentDefs['str-geometry'].inputs).toBe(0);
    expect(componentDefs['str-geometry'].outputs).toBe(1);
  });

  test('Sonuçlar zincirin SONU — çıkışı yok', () => {
    expect(componentDefs['str-results'].inputs).toBe(1);
    expect(componentDefs['str-results'].outputs).toBe(0);
  });

  test('ortadaki iki bileşen tek giriş / tek çıkış', () => {
    ['str-mesh', 'str-bc'].forEach((t) => {
      expect(componentDefs[t].inputs).toBe(1);
      expect(componentDefs[t].outputs).toBe(1);
    });
  });

  test('adlar Türkçe ve zincir sırasını anlatıyor', () => {
    expect(componentDefs['str-geometry'].name).toBe('Geometri');
    expect(componentDefs['str-mesh'].name).toBe('Hesaplama Ağı');
    expect(componentDefs['str-bc'].name).toBe('Sınır Koşulları');
    expect(componentDefs['str-results'].name).toBe('Sonuçlar');
  });

  test('her zincir bileşeninin kanvas sembolü var (palet ile tek kaynak)', () => {
    ['str-geometry', 'str-mesh', 'str-bc', 'str-results'].forEach((t) => {
      expect(componentDefs[t].svg).toMatch(/^<svg/);
    });
  });
});

// ── 3) Başlangıç yerleşimi ve kenarları ─────────────────────────────────────
describe('VE_STR_STARTER_LAYOUT / CHAIN', () => {
  test('yerleşim tam dört bileşen — künye kartı YOK', () => {
    const tipler = str.VE_STR_STARTER_LAYOUT.map((i) => i.type);
    expect(tipler).toEqual(['str-geometry', 'str-mesh', 'str-bc', 'str-results']);
  });

  test('kenarlar İNDİSLE değil TİPLE yazılı ve zinciri baştan sona bağlıyor', () => {
    expect(str.VE_STR_STARTER_CHAIN).toEqual([
      ['str-geometry', 'str-mesh'],
      ['str-mesh', 'str-bc'],
      ['str-bc', 'str-results'],
    ]);
    // Her kenarın iki ucu da yerleşimde geçmeli (yazım hatası kapısı)
    const yerlesim = new Set(str.VE_STR_STARTER_LAYOUT.map((i) => i.type));
    str.VE_STR_STARTER_CHAIN.forEach(([a, b]) => {
      expect(yerlesim.has(a)).toBe(true);
      expect(yerlesim.has(b)).toBe(true);
    });
  });

  test('kenar yönü port sözleşmesine UYUYOR — çıkışı olmayana bağlanmaz', () => {
    str.VE_STR_STARTER_CHAIN.forEach(([a, b]) => {
      expect(componentDefs[a].outputs).toBeGreaterThan(0);
      expect(componentDefs[b].inputs).toBeGreaterThan(0);
    });
  });
});

// ── 4) Paneller — smoke (içerik bilerek boş) ────────────────────────────────
describe('paneller üretiliyor ve sızıntı yok', () => {
  const uretecler = [
    ['modül', str.getStrModulePropertiesHTML],
    ['Geometri', str.getStrGeometryPropertiesHTML],
    ['Hesaplama Ağı', str.getStrMeshPropertiesHTML],
    ['Sınır Koşulları', str.getStrBCPropertiesHTML],
    ['Sonuçlar', str.getStrResultsPropertiesHTML],
  ];

  test.each(uretecler)('%s paneli patlamıyor ve undefined/NaN sızdırmıyor', (_ad, fn) => {
    const html = fn({ id: 'n1', type: 'x', data: {} });
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(0);
    expect(html).not.toMatch(/undefined|NaN|\[object/);
  });

  test('modül paneli alt topolojiyi açan düğmeyi taşır', () => {
    const html = str.getStrModulePropertiesHTML({ id: 'n7', type: 'structural-analysis', data: {} });
    expect(html).toContain("veStrOpenEditor('n7')");
  });

  // Boş panel SESSİZ olmamalı: kullanıcı iskeletin nerede bittiğini görmeli.
  // (cp-fead.js _feadPending ile aynı gerekçe — CLAUDE.md'de yazılı.)
  // Geometri ARTIK DOLU (STEP içe aktarma) → listeden çıkarıldı; kalan üçü
  // hâlâ iskelet ve eksiğini söylemek ZORUNDA.
  const hala_iskelet = uretecler.filter(([ad]) => ['Hesaplama Ağı', 'Sınır Koşulları', 'Sonuçlar'].includes(ad));

  test('hâlâ iskelet olan panel sayısı üç — biri dolunca bu liste güncellenmeli', () => {
    expect(hala_iskelet).toHaveLength(3);
  });

  test.each(hala_iskelet)('%s paneli eksiğini SÖYLÜYOR', (_ad, fn) => {
    expect(fn({ id: 'n1', type: 'x', data: {} })).toContain('Bileşen bekleniyor');
  });

  test('Geometri paneli ARTIK iskelet değil — içe aktarma yüzeyi taşıyor', () => {
    const html = str.getStrGeometryPropertiesHTML({ id: 'n1', type: 'str-geometry', data: {} });
    expect(html).not.toContain('Bileşen bekleniyor');
    expect(html).toContain('veStrGeomPick(\'n1\')');
    expect(html).toContain('accept=".step,.stp"');
    // Sürükle-bırak da bağlı: dragover'sız bir drop hedefi tarayıcıyı dosyaya
    // GÖTÜRÜR (measure-dropzone.js'te belgelenmiş hata sınıfı).
    expect(html).toContain('veStrGeomDragOver(event)');
    expect(html).toContain('veStrGeomDrop(\'n1\', event)');
  });

  test('geometri YOKKEN 3B kanvas kurulmuyor — boş WebGL bağlamı açılmasın', () => {
    const bos = str.getStrGeometryPropertiesHTML({ id: 'n1', type: 'str-geometry', data: {} });
    expect(bos).not.toContain('id="ve-str-geom-canvas"');
    const dolu = str.getStrGeometryPropertiesHTML({
      id: 'n1', type: 'str-geometry',
      data: { geometry: { fileName: 'x.step', fileSize: 10, stats: { meshCount: 1, triCount: 12, faceCount: 6 }, bbox: { size: [1, 2, 3], diag: 4 }, faces: [], sourceKept: true } }
    });
    expect(dolu).toContain('id="ve-str-geom-canvas"');
  });

  test('kaynağın projeye YAZILIP yazılmadığı panelde AÇIKÇA yazılı', () => {
    // Durum CANLI depodan okunuyor — künyeye yazılmış bayat bir bayraktan
    // DEĞİL. Kaynak node.data'da durmuyor (undo yığınını şişiriyordu), o
    // yüzden panel model katmanına soruyor.
    const mk = () => str.getStrGeometryPropertiesHTML({
      id: 'n1', type: 'str-geometry',
      data: { geometry: { fileName: 'x.step', fileSize: 10, stats: { meshCount: 1, triCount: 12, faceCount: 6 }, bbox: { size: [1, 2, 3], diag: 4 }, faces: [] } }
    });
    const onceki = global.veStrSrcWillPersist;
    try {
      global.veStrSrcWillPersist = () => true;
      expect(mk()).toContain('kaydedilirken');
      global.veStrSrcWillPersist = () => false;
      // Sessiz bırakılsaydı kullanıcı projeyi kaydedip kapatır, geometrinin
      // gitmiş olduğunu ancak yeniden açtığında görürdü.
      expect(mk()).toContain('yeniden içe aktarılması');
    } finally { global.veStrSrcWillPersist = onceki; }
  });

  test('künye STEP kaynağı TAŞIMIYOR — undo yığını şişmesin', () => {
    // ÖLÇÜLDÜ: 140 KB'lık kaynak node.data'dayken saveState 0,03 → 2,17 ms ve
    // 20 adımlık undo yığını 22 KB → 3,14 MB oluyordu. Kaynak artık oturumluk
    // depoda; künyeye geri sızarsa bu test kırmızıya döner.
    const src = require('../../js/structural-model.js');
    const geom = {
      ok: true, fileName: 'x.step', fileSize: 999, unit: 'millimeter',
      stats: { meshCount: 1, triCount: 2, faceCount: 1 },
      bbox: { min: [0, 0, 0], max: [1, 1, 1], size: [1, 1, 1], center: [0, 0, 0], diag: 1 },
      meshes: [{ positions: new Float32Array(9), indices: new Uint32Array(3) }],
      faces: [{ id: 'm0/f0', meshName: 'x', triCount: 2 }],
    };
    const rec = src.veStrGeomRecord(geom);
    expect(rec.source).toBeUndefined();
    expect(rec.sourceGz).toBeUndefined();
    expect(JSON.stringify(rec)).not.toMatch(/source/);
  });
});

// ── 5) İSKELET BEŞ DOSYAYA BAĞLI — biri unutulursa kayıt bozulur ────────────
describe('modül kablolaması eksiksiz', () => {
  const oku = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

  test('cp-core.js panel dağıtımı beş tipi de tanıyor', () => {
    const s = oku('js/cp-core.js');
    expect(s).toContain('getStrModulePropertiesHTML');
    ['Geometry', 'Mesh', 'BC', 'Results'].forEach((k) => {
      expect(s).toContain('getStr' + k + 'PropertiesHTML');
    });
    // Modül kartı KOMPAKT panel listesinde (diğer üç modül gibi)
    expect(s).toMatch(/VE_COMPACT_PANEL_TYPES[\s\S]{0,400}'structural-analysis'/);
  });

  test('ui-core.js çift tıkta editörü açıyor', () => {
    expect(oku('js/ui-core.js')).toContain("node.type === 'structural-analysis' && typeof veStrOpenEditor");
  });

  test('topology.js DÖRT kancayı da taşıyor (busy / köke çökme / gezinme / sıfırlama)', () => {
    const s = oku('js/topology.js');
    expect(s).toContain('_veStrBusy');            // yeniden-girişe karşı
    expect(s).toContain('veStrCollapseToRoot');   // kaydetmeden önce köke çök
    expect(s).toContain('veStrOpenEditor');       // gezinme geri yükleme
    expect(s).toContain('veStrStack.length = 0'); // proje değişince sıfırla
    expect(s).toContain('_strForgetResults');     // oturumluk sonucu unut
  });

  test('components.js sidebar kapsamını modül içinde değiştiriyor', () => {
    expect(oku('js/components.js')).toContain("scope = 'structural-analysis'");
  });

  test('index.html: script etiketi, palet satırı, kapsam kategorisi, karşılama kartı', () => {
    const s = oku('index.html');
    expect(s).toContain('src="js/cp-structural.js"');
    expect(s).toContain('data-type="structural-analysis"');
    expect(s).toContain('data-ve-scope="structural-analysis"');
    expect(s).toContain("veStartModule('structural-analysis')");
    ['str-geometry', 'str-mesh', 'str-bc', 'str-results'].forEach((t) => {
      expect(s).toContain('data-type="' + t + '"');
    });
  });

  // ── GEOMETRİ İÇE AKTARMA — DÖRT PARÇAYA BİRDEN BAĞLI ────────────────────
  // Vendorlu okuyucu, köprü, görüntüleyici ve panel kancası. Biri düşerse
  // panel yine açılır ve "içe aktar" düğmesi yine görünür — ama basınca
  // HİÇBİR ŞEY olmaz. Sessiz kırılma tam olarak bu kapının konusu.
  test('index.html: STEP okuyucusu, köprü ve 3B görüntüleyici yüklü', () => {
    const s = oku('index.html');
    expect(s).toContain('src="vendor/occt-import-js.js"');
    expect(s).toContain('src="js/structural-model.js"');
    expect(s).toContain('src="js/cp-structural-viewer.js"');
  });

  test('vendorlu okuyucu ve .wasm depoda duruyor', () => {
    // .wasm 7.3 MB ve tek dosya build'ine GÖMÜLMÜYOR (boyut + LGPL-2.1);
    // çalışma anında yanından çekiliyor. Depoda yoksa özellik hiç çalışmaz.
    expect(fs.existsSync(path.join(ROOT, 'vendor/occt-import-js.js'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'vendor/occt-import-js.wasm'))).toBe(true);
    // LGPL-2.1 → lisans metni dağıtımla birlikte durmak zorunda.
    expect(fs.existsSync(path.join(ROOT, 'vendor/license.occt.txt'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'vendor/license.occt-import-js.txt'))).toBe(true);
  });

  test('CI deploy .wasm\'i Pages\'e kopyalıyor — yoksa yayında 404', () => {
    // build.js vendor JS'lerini inline ediyor ama bir WASM ikilisi script
    // etiketine giremez; deploy adımı yalnız MFSim_Code.html kopyalıyordu.
    const yml = oku('.github/workflows/ci-deploy.yml');
    expect(yml).toContain('_site/vendor/occt-import-js.wasm');
  });

  test('cp-core.js: Geometri geniş panel + 3B görüntüleyici kancası', () => {
    const s = oku('js/cp-core.js');
    expect(s).toMatch(/VE_WIDE_PANEL_TYPES[\s\S]{0,900}'str-geometry'/);
    expect(s).toContain('veStrGeomMountViewer');
  });

  test('proje değişince içe aktarılmış geometri UNUTULUYOR', () => {
    // Takoz/FEAD'deki tuzağın aynısı: temizlenmezse yeni projede önceki
    // projenin parçası görüntüleyicide durur.
    const s = oku('js/cp-structural.js');
    expect(s).toMatch(/_strForgetResults[\s\S]{0,600}veStrGeomCacheClear/);
    expect(s).toMatch(/_strForgetResults[\s\S]{0,600}veStrViewerDispose/);
  });

  test('cp-structural.js index.html\'de fead-model/core SONRASINDA yüklenir değil — sırası serbest ama TEK kez', () => {
    const s = oku('index.html');
    expect(s.match(/src="js\/cp-structural\.js"/g)).toHaveLength(1);
  });
});

// ── 6) Sidebar kapsamı ──────────────────────────────────────────────────────
describe('veSyncSidebarScope', () => {
  test('yığın boşken kök, doluyken modül kapsamı', () => {
    global.veStrStack = [];
    veSyncSidebarScope();
    expect(veSidebarScope).toBe('top');

    global.veStrStack = [{ nodeId: 'n1' }];
    veSyncSidebarScope();
    expect(veSidebarScope).toBe('structural-analysis');
    global.veStrStack = [];
  });
});
