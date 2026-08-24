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
// Tarayıcıda js/structural-materials.js düz <script> olarak yükleniyor ve
// bildirdikleri GERÇEK global. Node'da cp-structural.js `require` ile geldiği
// için serbest tanımlayıcılar `global`e düşüyor — köprüyü burada kuruyoruz.
const MATLIB = require('../../js/structural-materials.js');
Object.keys(MATLIB).forEach((k) => { global[k] = MATLIB[k]; });
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
    ['structural-analysis', 'str-geometry', 'str-material', 'str-mesh', 'str-bc', 'str-results']
      .forEach((t) => expect(list).toContain(t));
  });
});

// ── 2) ZİNCİR — port sayıları yapısal kapı ──────────────────────────────────
describe('analiz zinciri porttan okunuyor: Geometri → Ağ → Sınır Koşulları → Sonuçlar', () => {
  test('Geometri zincirin BAŞI — GİRİŞİ YOK (ters kurulamaz)', () => {
    // Kapının aslı bu satır: giriş yoksa hiçbir bileşen Geometri'ye AKAMAZ,
    // yani zincir ters kurulamaz. 'Malzeme ve Özellikler' eklendiğinde bu
    // kapıyı zayıflatmamak için malzeme Geometri'nin ÇIKIŞINDAN beslendi —
    // girişi açmak zincirin başını kaybettirirdi.
    expect(componentDefs['str-geometry'].inputs).toBe(0);
  });

  test('Geometri\'nin İKİ çıkışı AYRI kenarlarda — zincir sağ, malzeme alt', () => {
    // output-0 = analiz zinciri (Ağ'a), output-1 = malzeme eki (alta iner).
    // Tek porta iki tel de bağlanabilirdi ama ikisi AYNI ağızdan çıkardı:
    // alttaki malzeme kutusuna giden tel sağa çıkıp geri dönerdi.
    expect(componentDefs['str-geometry'].outputs).toBe(2);
    expect(componentDefs['str-geometry'].portLayout.outputs).toEqual(['right', 'bottom']);
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
    ['str-geometry', 'str-material', 'str-mesh', 'str-bc', 'str-results'].forEach((t) => {
      expect(componentDefs[t].svg).toMatch(/^<svg/);
    });
  });
});

// ── 3) Başlangıç yerleşimi ve kenarları ─────────────────────────────────────
describe('VE_STR_STARTER_LAYOUT / CHAIN', () => {
  test('yerleşim dört zincir halkası + Malzeme eki — künye kartı YOK', () => {
    const tipler = str.VE_STR_STARTER_LAYOUT.map((i) => i.type);
    expect(tipler).toEqual(['str-geometry', 'str-mesh', 'str-bc', 'str-results', 'str-material']);
  });

  test('Malzeme zincir ŞERİDİNİN ALTINDA ve Geometri ile ORTALI', () => {
    const it = (t) => str.VE_STR_STARTER_LAYOUT.find((i) => i.type === t);
    const geo = it('str-geometry');
    const mat = it('str-material');
    // Zincirin dördü aynı ly'de bir şerit; Malzeme o şeridin ALTINDA.
    ['str-geometry', 'str-mesh', 'str-bc', 'str-results'].forEach((t) => {
      expect(it(t).ly).toBe(geo.ly);
    });
    expect(mat.ly).toBeGreaterThan(geo.ly + componentDefs['str-geometry'].defaultHeight);
    // Tel dümdüz insin: iki kutunun MERKEZLERİ aynı x'te (portlar %50'de).
    const cGeo = geo.lx + componentDefs['str-geometry'].defaultWidth / 2;
    const cMat = mat.lx + componentDefs['str-material'].defaultWidth / 2;
    expect(Math.abs(cGeo - cMat)).toBeLessThanOrEqual(1);
  });

  test('kenarlar İNDİSLE değil TİPLE yazılı, PORT da açıkça yazılı', () => {
    expect(str.VE_STR_STARTER_CHAIN).toEqual([
      ['str-geometry', 'str-mesh', 'output-0', 'input'],
      ['str-mesh', 'str-bc', 'output', 'input'],
      ['str-bc', 'str-results', 'output', 'input'],
      ['str-geometry', 'str-material', 'output-1', 'input'],
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

  // ÖLÇÜLDÜ (gerçek tarayıcı): dört ad konumu, iki çakışma ölçütü —
  //   bottom (varsayılan)  tel adı KESİYOR                          ✗
  //   top                  tel temiz, STEP ROZETİ adın üstünde      ✗
  //   right                tel temiz, ad ZİNCİR TELİNİN üstünde     ✗
  //   left                 ikisi de temiz                           ✓
  // Malzeme teli Geometri'nin alt portundan dümdüz iniyor ve varsayılan yerdeki
  // ad tam onun altında ortalı duruyordu.
  test('Geometri\'nin adı SOLA alınmış — dik inen malzeme telinin altından çekilsin', () => {
    const geo = str.VE_STR_STARTER_LAYOUT.find((i) => i.type === 'str-geometry');
    expect(geo.labelPos).toBe('left');
    // Yalnız Geometri: kalanların altında tel yok, taşımanın karşılığı da yok.
    str.VE_STR_STARTER_LAYOUT.filter((i) => i.type !== 'str-geometry')
      .forEach((i) => expect(i.labelPos).toBeUndefined());
  });

  // Tabloya yazmak yetmez, KURULUMA da geçmeli: yalnız yerleşim tablosuna
  // bakan bir kapı, `veStrPopulateStarter`'ın o alanı hiç okumadığı bir sürümde
  // de yeşil kalırdı (mutasyonla ölçüldü — kapı eklenene kadar geçiyordu).
  test('veStrPopulateStarter yerleşimi DÜĞÜME yazıyor: ad, port, kenar', () => {
    const kurulan = [];
    const teller = [];
    global.nodes = [];
    global.createNode = (type, x, y) => {
      const n = { id: 'n' + kurulan.length, type, x, y, data: {} };
      kurulan.push(n);
      global.nodes.push(n);
      return n;
    };
    global.createConnection = (f, t, fp, tp) => teller.push([f, t, fp, tp]);
    global.updateAllConnections = () => {};
    global.veArrangeModuleBase = () => ({ x: 0, y: 0 });
    global.applyNodeLabelPos = jest.fn();

    const cikan = str.veStrPopulateStarter();
    expect(cikan).toHaveLength(str.VE_STR_STARTER_LAYOUT.length);

    const geo = kurulan.find((n) => n.type === 'str-geometry');
    const mat = kurulan.find((n) => n.type === 'str-material');
    expect(geo.data.labelPos).toBe('left');           // ad gerçekten taşındı
    expect(global.applyNodeLabelPos).toHaveBeenCalled(); // ve DOM'a da uygulandı
    expect(mat.data.labelPos).toBeUndefined();

    // Malzeme teli Geometri'nin ALT çıkışından, Malzeme'nin ÜST girişine.
    const tel = teller.find((t) => t[1] === mat.id);
    expect(tel).toEqual([geo.id, mat.id, 'output-1', 'input']);
    // Zincir teli hâlâ SAĞ çıkıştan.
    const mesh = kurulan.find((n) => n.type === 'str-mesh');
    expect(teller.find((t) => t[1] === mesh.id)).toEqual([geo.id, mesh.id, 'output-0', 'input']);

    delete global.createNode; delete global.createConnection;
    delete global.updateAllConnections; delete global.veArrangeModuleBase;
    delete global.applyNodeLabelPos;
    global.nodes = [];
  });

  // Geometri bir çıkıştan İKİ çıkışa geçti: bu değişiklikten ÖNCE kaydedilmiş
  // projelerde bağlantı `fromPort: 'output'` taşıyor ve o ad artık yok.
  // ÖLÇÜLDÜ (gerçek tarayıcı): çizici eski adı da SAĞ kenarın ortasına
  // koyuyor — yeni `output-0` ile sapma 0,00 px, yani eski projelerde tel
  // yerinden oynamıyor ve bir göç adımına gerek kalmıyor.
  test('ESKİ kayıtlardaki \'output\' adı yeni \'output-0\' ile AYNI noktada', () => {
    const geo = { type: 'str-geometry', width: 62, height: 56, data: {} };
    const yeni = vePortOffset(geo, 'output-0');
    const eski = vePortOffset(geo, 'output');
    expect(eski.side).toBe(yeni.side);
    expect(eski.side).toBe('right');
    expect(Math.hypot(yeni.dx - eski.dx, yeni.dy - eski.dy)).toBeCloseTo(0, 9);
    // Malzeme portu ise ALT kenarın ortasında — telin dik inmesi buradan.
    const alt = vePortOffset(geo, 'output-1');
    expect(alt.side).toBe('bottom');
    expect(alt.dx).toBeCloseTo(62 / 2, 9);
    const mat = { type: 'str-material', width: 50, height: 46, data: {} };
    const ust = vePortOffset(mat, 'input');
    expect(ust.side).toBe('top');
    expect(ust.dx).toBeCloseTo(50 / 2, 9);
  });

  // Geometri artık İKİ çıkışlı: port adı varsayılana ('output') bırakılsaydı
  // iki tel de AYNI ağızdan çıkardı ve alt kenar hiç kullanılmazdı.
  test('yazılan port adları gerçekten VAR — çıkış sayısıyla uyumlu', () => {
    str.VE_STR_STARTER_CHAIN.forEach(([a, , fp]) => {
      const n = componentDefs[a].outputs;
      const gecerli = n === 1 ? ['output'] : Array.from({ length: n }, (_, i) => 'output-' + i);
      expect(gecerli).toContain(fp);
    });
  });
});

// ── 4) Paneller — smoke (içerik bilerek boş) ────────────────────────────────
describe('paneller üretiliyor ve sızıntı yok', () => {
  const uretecler = [
    ['modül', str.getStrModulePropertiesHTML],
    ['Geometri', str.getStrGeometryPropertiesHTML],
    ['Malzeme ve Özellikler', str.getStrMaterialPropertiesHTML],
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

  // Boş panel SESSİZ olmamalı: kullanıcı bileşenin kullanıma açık olmadığını
  // görmeli. (cp-fead.js _feadPending ile aynı gerekçe — CLAUDE.md'de yazılı.)
  // Metin DURUM bildirir; ne kullanım anlatır ne de geliştirme planı duyurur.
  // Geometri (STEP içe aktarma) ve Hesaplama Ağı (TetGen) ARTIK DOLU →
  // listeden çıkarıldılar; kalan ikisi hâlâ iskelet ve eksiğini söylemek ZORUNDA.
  const hala_iskelet = uretecler.filter(([ad]) => ['Sınır Koşulları', 'Sonuçlar'].includes(ad));

  test('hâlâ iskelet olan panel sayısı iki — biri dolunca bu liste güncellenmeli', () => {
    expect(hala_iskelet).toHaveLength(2);
  });

  test.each(hala_iskelet)('%s paneli eksiğini SÖYLÜYOR', (_ad, fn) => {
    expect(fn({ id: 'n1', type: 'x', data: {} })).toContain('Kullanıma açık değil');
  });

  test('Geometri paneli ARTIK iskelet değil — içe aktarma yüzeyi taşıyor', () => {
    const html = str.getStrGeometryPropertiesHTML({ id: 'n1', type: 'str-geometry', data: {} });
    expect(html).not.toContain('Kullanıma açık değil');
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
      expect(mk()).toContain('proje dosyasına');
      global.veStrSrcWillPersist = () => false;
      // Sessiz bırakılsaydı kullanıcı projeyi kaydedip kapatır, geometrinin
      // gitmiş olduğunu ancak yeniden açtığında görürdü.
      expect(mk()).toContain('yeniden içe aktarma gerekiyor');
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

// ── 4b) MALZEME VE ÖZELLİKLER — Geometri'ye asılan ALT bileşen ──────────────
// Buradaki değer üç yerde: (a) kutunun ALT BİLEŞEN olduğunun yapısal kanıtı
// (küçük + çıkışsız), (b) ν < 0,5 tekillik kapısı, (c) ρ'nun kg/m³ → ton/mm³
// çevrimi. Sonuncusu FEA'nın klasik SESSİZ hatası: 7850'i mm·N·MPa modeline
// doğrudan yazmak kütleyi 10¹² kat büyütür, çözüm yine koşar.
describe('str-material — alt bileşen sözleşmesi', () => {
  const def = () => componentDefs['str-material'];

  test('ÇIKIŞI YOK → zincire ara halka olarak sokulamaz', () => {
    // Kutunun \"alt bileşen\" olmasının YAPISAL yarısı: Malzeme'den çıkan tel
    // olmadığı için \"Geometri → Malzeme → Ağ\" diye yanlış bir zincir kurulamaz.
    expect(def().outputs).toBe(0);
    expect(def().inputs).toBe(1);
  });

  test('kutu zincir bileşenlerinden KÜÇÜK — hiyerarşi ölçüden okunuyor', () => {
    // Görsel yarısı: kullanıcı \"bu bir alt bileşen\" bilgisini yazıya gerek
    // kalmadan ölçüden alıyor (aksesuarların Motor'a asılırkenki kalıbı).
    ['str-geometry', 'str-mesh', 'str-bc', 'str-results'].forEach((t) => {
      expect(def().defaultWidth).toBeLessThan(componentDefs[t].defaultWidth);
      expect(def().defaultHeight).toBeLessThan(componentDefs[t].defaultHeight);
    });
  });

  test('giriş ÜST kenarda — tel Geometri\'nin alt portundan dümdüz iner', () => {
    // Klasik \"giriş solda\" bırakılsaydı tel sağa çıkıp sola dönerdi.
    expect(def().portLayout.inputs).toEqual(['top']);
    expect(componentDefs['str-geometry'].portLayout.outputs[1]).toBe('bottom');
  });

  test('adı ve modül bayrağı', () => {
    expect(def().name).toBe('Malzeme ve Özellikler');
    expect(def().isStrMaterial).toBe(true);
    // Alt-sistem DEĞİL: çift tıkla açılan bir iç topolojisi yok.
    expect(def().isSubsystem).toBeUndefined();
  });
});

describe('malzeme verisi — doğrulama ve türetme', () => {
  const celik = { name: 'S355JR', E: 210000, nu: 0.3, rho: 7850, sy: 355, su: 510 };

  test('E ve ν yeterli — geri kalanı yalnız bir YETENEĞİ kapatır', () => {
    // Hepsi tek \"zorunlu\" torbasına atılsaydı ρ'suz bir model \"çözülemez\"
    // ilan edilirdi; oysa öz ağırlıksız gerilme çözümü geçerli bir analizdir.
    const v = str.veStrMatValidate({ E: 210000, nu: 0.3 });
    expect(v.ok).toBe(true);
    expect(v.errors).toHaveLength(0);
    expect(v.warns.join(' ')).toMatch(/ρ|Yoğunluk/);
    expect(v.warns.join(' ')).toMatch(/σ_ak|Akma/);
  });

  test('E ya da ν eksikse ÇÖZÜM YOK', () => {
    expect(str.veStrMatValidate({ nu: 0.3 }).ok).toBe(false);
    expect(str.veStrMatValidate({ E: 210000 }).ok).toBe(false);
    expect(str.veStrMatValidate({}).ok).toBe(false);
    expect(str.veStrMatValidate({ E: 0, nu: 0.3 }).ok).toBe(false);
    expect(str.veStrMatValidate({ E: -1, nu: 0.3 }).ok).toBe(false);
  });

  // TEKİLLİK KAPISI: K = E / (3(1−2ν)) → ν = 0,5'te payda sıfır.
  test('ν ≥ 0,5 REDDEDİLİYOR — K ıraksar, rijitlik matrisi tekilleşir', () => {
    [0.5, 0.51, 0.7].forEach((nu) => {
      const v = str.veStrMatValidate({ E: 210000, nu });
      expect(v.ok).toBe(false);
      expect(v.errors.join(' ')).toMatch(/tekilleş|ıraksa/);
    });
    // ...ve türetilen K de sayı ÜRETMİYOR (NaN/Infinity sızmasın).
    expect(str.veStrMatDerived({ E: 210000, nu: 0.5 }).K).toBeNull();
  });

  test('0,49 < ν < 0,5 UYARILIYOR — çözüm koşar ama FAZLA RİJİT çıkar', () => {
    const v = str.veStrMatValidate({ E: 2000, nu: 0.499 });
    expect(v.ok).toBe(true);                       // durdurmuyor
    expect(v.warns.join(' ')).toMatch(/kilitlen/); // ama susmuyor da
  });

  test('σ_ç < σ_ak → alanlar yer değiştirmiş olabilir (uyarı)', () => {
    expect(str.veStrMatValidate({ E: 1, nu: 0.3, sy: 510, su: 355 }).warns.join(' '))
      .toMatch(/yer değiştirmiş/);
  });

  test('G ve K ders kitabı formülünden', () => {
    const d = str.veStrMatDerived(celik);
    expect(d.G).toBeCloseTo(210000 / (2 * 1.3), 6);       // 80 769 MPa
    expect(d.K).toBeCloseTo(210000 / (3 * 0.4), 6);       // 175 000 MPa
  });

  // ── SESSİZ BİRİM TUZAĞI ─────────────────────────────────────────────────
  // mm·N·MPa sisteminde kütle birimi TON. 7850 kg/m³ doğrudan yazılırsa kütle
  // 10¹² kat büyür — çözüm yine koşar, öz ağırlık altında parça \"erir\".
  test('ρ kg/m³ → ton/mm³ çevriliyor (çelik 7850 → 7,85e-9)', () => {
    expect(str.veStrMatDensityMM(7850)).toBeCloseTo(7.85e-9, 20);
    expect(str.VE_STR_RHO_SI_TO_MM).toBe(1e-12);
    // Alüminyum ve ham çevrim oranı da tutuyor mu
    expect(str.veStrMatDensityMM(2700)).toBeCloseTo(2.7e-9, 20);
    expect(str.veStrMatDensityMM(7850) / 7850).toBe(1e-12);
  });

  test('girilmemiş ρ 0 DEĞİL null — \"0 ölçüldü\" gibi görünmesin', () => {
    // Number(null) === 0 bu projede belgelenmiş sessiz hata sınıfı.
    [null, undefined, ''].forEach((v) => expect(str.veStrMatDensityMM(v)).toBeNull());
    expect(str.veStrMatDerived({}).rhoMM).toBeNull();
  });

  test('açıkça girilen 0 ise 0 olarak GEÇİYOR (girilmemişle karışmıyor)', () => {
    expect(str.veStrMatDensityMM(0)).toBe(0);
  });
});

describe('malzeme — kayıt, rozet ve bağlı geometri', () => {
  const mkNode = (id, type, data) => ({ id, type, data: data || {}, x: 0, y: 0, width: 50, height: 46 });

  test('veStrMatSet sayıyı SAYI olarak yazar, boş dizge alanı SİLER', () => {
    const n = mkNode('m1', 'str-material');
    global.nodes = [n];
    str.veStrMatSet('m1', 'E', '210000');
    expect(n.data.material.E).toBe(210000);
    str.veStrMatSet('m1', 'E', '');
    expect('E' in n.data.material).toBe(false);
    str.veStrMatSet('m1', 'name', 'S355JR');
    expect(n.data.material.name).toBe('S355JR');
  });

  test('elle düzenleme kaydı kütüphane kaydı olmaktan ÇIKARIR', () => {
    // Kütüphane geldiğinde \"hangi katalog kaydı\" sorusuna yanlış cevap vermesin.
    const n = mkNode('m1', 'str-material', { material: { source: 'library:s355', E: 210000 } });
    global.nodes = [n];
    str.veStrMatSet('m1', 'E', '205000');
    expect(n.data.material.source).toBe('manual');
  });

  test('bağlı Geometri TELDEN okunuyor — ikinci bir \"hedef\" alanı yok', () => {
    const geo = mkNode('g1', 'str-geometry');
    const mat = mkNode('m1', 'str-material');
    const yad = mkNode('x1', 'str-mesh');
    global.nodes = [geo, mat, yad];
    global.connections = [];
    expect(str.veStrMatHost(mat)).toBeNull();
    global.connections = [{ from: 'x1', to: 'm1', fromPort: 'output', toPort: 'input' }];
    expect(str.veStrMatHost(mat)).toBeNull();     // Ağ'dan gelen tel host DEĞİL
    global.connections.push({ from: 'g1', to: 'm1', fromPort: 'output-1', toPort: 'input' });
    expect(str.veStrMatHost(mat)).toBe(geo);
  });

  test('rozet: AMBER yalnız çözülebilir kayıtta', () => {
    // Adı yazılmış ama E'si girilmemiş bir malzeme \"hazır\" görünmemeli.
    expect(str.veStrMatBadgeInfo(mkNode('m', 'str-material')).ready).toBe(false);
    expect(str.veStrMatBadgeInfo(mkNode('m', 'str-material', { material: { name: 'S355JR' } })).ready).toBe(false);
    const tam = str.veStrMatBadgeInfo(mkNode('m', 'str-material', { material: { name: 'S355JR', E: 210000, nu: 0.3 } }));
    expect(tam.ready).toBe(true);
    expect(tam.text).toBe('S355JR');
  });

  test('rozet BOŞKEN de var — \"rozet yok\" ile \"malzeme yok\" ayırt edilemezdi', () => {
    document.body.innerHTML = '<div id="m1"><div class="ve-node-box"></div></div>';
    const el = document.getElementById('m1');
    expect(str.veStrApplyBadge(el, mkNode('m1', 'str-material'))).toBe(true);
    expect(el.querySelector('.ve-str-badge').textContent).toBe('MALZ');
    // ...ve dolduğunda değişiyor
    str.veStrApplyBadge(el, mkNode('m1', 'str-material', { material: { name: 'AlSi10Mg', E: 70000, nu: 0.33 } }));
    expect(el.querySelector('.ve-str-badge').textContent).toBe('AlSi10Mg');
    // Rozet TEK: eskisi kaldırılmadan yenisi eklenirse iki rozet üst üste biner.
    expect(el.querySelectorAll('.ve-str-badge')).toHaveLength(1);
  });

  test('adsız ama E girilmiş kayıt rozetde GPa okur', () => {
    expect(str.veStrMatBadgeInfo(mkNode('m', 'str-material', { material: { E: 210000, nu: 0.3 } })).text)
      .toBe('210 GPa');
  });
});

describe('malzeme paneli', () => {
  const mk = (data) => str.getStrMaterialPropertiesHTML({ id: 'm1', type: 'str-material', data: data || {} });

  test('İSKELET DEĞİL — \"Bileşen bekleniyor\" demiyor', () => {
    // _strPending işareti \"bu panel henüz çalışmıyor\" demek ve iskelet sayacı
    // ona bakıyor; çalışan bir panelde kullanmak o sayacı bozardı.
    expect(mk()).not.toContain('Bileşen bekleniyor');
  });

  test('İKİ SÜTUN: solda katalog, sağda uygulanan kayıt', () => {
    // Bölüşüm görüntüye göre değil SORUYA göre: \"hangi malzemeler var\" ile
    // \"bu parçanın malzemesi ne\" ayrı iki soru ve ikincisi birincisine
    // bakarken görünmek zorunda.
    const h = mk();
    expect(h).toContain('ve-str-mat-col-lib');
    expect(h).toContain('ve-str-mat-col-cur');
    expect(h).toContain('Malzeme Kütüphanesi');
    expect(h).toContain('Uygulanan Malzeme');
  });

  test('katalog listesi ve süzgeçleri panelde kurulu', () => {
    const h = mk();
    expect(h).toContain('id="ve-str-mat-list"');
    expect(h).toContain('id="ve-str-mat-q"');
    expect(h).toContain("veStrMatLibQuery('m1'");
    expect(h).toContain("veStrMatLibSetCat('m1'");
    // Bütün aileler süzgeçte
    MATLIB.VE_STR_MAT_CATS.forEach((c) => expect(h).toContain('value="' + c.key + '"'));
  });

  test('GEÇERLİLİK SINIRI listenin ÜSTÜNDE yazılı — nominal ≠ sertifika', () => {
    // Katalog değerini ölçülmüş değer sanmak bu modülün en pahalı sessiz
    // hatası olurdu; uyarı paneli değil LİSTEYİ karşılıyor.
    const h = mk();
    expect(h).toContain('nominal');
    expect(h).toContain('EN 10204');
    expect(h).toContain(String(MATLIB.VE_STR_MAT_LIB_TEMP_C) + ' °C');
    expect(h.indexOf('nominal')).toBeLessThan(h.indexOf('id="ve-str-mat-list"'));
  });

  test('KATALOGDA OLMAYANLAR yazılı — olmayan yetenek varmış gibi görünmesin', () => {
    const h = mk();
    expect(h).toContain('Katalogda olmayanlar');
    expect(h).toMatch(/ortotrop/);
    expect(h).toMatch(/S-N/);
  });

  test('kütüphane YÜKLENMEZSE panel sessiz kalmıyor', () => {
    const yedek = global.VE_STR_MAT_LIB;
    try {
      delete global.VE_STR_MAT_LIB;
      const h = mk();
      expect(h).toContain('kütüphanesi yüklenmedi');
      // ...ve sağ sütun (elle giriş) YİNE ÇALIŞIYOR: kütüphane bir kolaylık,
      // bileşenin çalışma şartı değil.
      expect(h).toContain("veStrMatSet('m1','E'");
    } finally { global.VE_STR_MAT_LIB = yedek; }
  });

  test('altı alanın altısı da panelde ve TEK kaynaktan geliyor', () => {
    const h = mk();
    str.VE_STR_MAT_FIELDS.forEach((f) => {
      expect(h).toContain("veStrMatSet('m1','" + f.key + "'");
    });
    expect(str.VE_STR_MAT_FIELDS.map((f) => f.key))
      .toEqual(['E', 'nu', 'rho', 'sy', 'su', 'alpha']);
  });

  test('Geometri\'ye BAĞLI DEĞİLKEN panel bunu SÖYLÜYOR', () => {
    // Sessiz bırakılsaydı kullanıcı malzemeyi girer, kaydeder ve çözücü onu
    // hiç görmezdi.
    global.nodes = [];
    global.connections = [];
    expect(mk()).toContain('bağlı değil');
  });

  test('bağlıyken parçanın künyesi panelde', () => {
    const geo = {
      id: 'g1', type: 'str-geometry', x: 0, y: 0,
      data: { geometry: { fileName: 'braket.step', stats: { meshCount: 7, triCount: 4902, faceCount: 240 }, bbox: { size: [131, 150.8, 131.8] } } },
    };
    global.nodes = [geo, { id: 'm1', type: 'str-material', data: {}, x: 0, y: 0 }];
    global.connections = [{ from: 'g1', to: 'm1', fromPort: 'output-1', toPort: 'input' }];
    const h = mk();
    expect(h).toContain('braket.step');
    expect(h).toContain('240');
    expect(h).not.toContain('bağlı değil');
    global.nodes = [];
    global.connections = [];
  });

  test('ρ\'nun ÇÖZÜCÜYE GİDEN hâli panelde yazılı — tahmin ettirmiyor', () => {
    expect(mk({ material: { E: 210000, nu: 0.3, rho: 7850 } })).toContain('ton/mm³');
  });

  test('tekillik hatası panelde GÖRÜNÜYOR', () => {
    expect(mk({ material: { E: 210000, nu: 0.5 } })).toMatch(/tekilleş|ıraksa/);
  });

  test('undefined/NaN sızmıyor — dolu ve boş kayıtta', () => {
    [undefined, { material: {} }, { material: { E: 210000, nu: 0.3, rho: 7850, sy: 355, su: 510, alpha: 12, name: 'S355JR' } }]
      .forEach((d) => expect(mk(d)).not.toMatch(/undefined|NaN|\[object/));
  });
});

// ── 4c) KÜTÜPHANEDEN UYGULAMA — katalog ↔ düğüm ────────────────────────────
describe('malzeme kütüphanesinden uygulama', () => {
  const mkNode = (id) => ({ id, type: 'str-material', data: {}, x: 0, y: 0, width: 50, height: 46 });

  beforeEach(() => {
    document.body.innerHTML = '<div id="m1"><div class="ve-node-box"></div></div>';
  });

  test('uygulanan kayıt KOPYA — katalog güncellemesi eski projeyi bozmaz', () => {
    // Kütüphane bir REFERANS olsaydı, katalogda bir değer düzeltildiğinde
    // kaydedilmiş bir analizin sayıları SESSİZCE değişirdi. Bu projenin en
    // çok kaçındığı hata sınıfı bu.
    const n = mkNode('m1');
    global.nodes = [n];
    expect(str.veStrMatApplyLib('m1', 's355jr')).toBe(true);
    expect(n.data.material.E).toBe(210000);
    expect(n.data.material.sy).toBe(355);
    expect(n.data.material.lib).toBe('s355jr');
    expect(n.data.material.libVer).toBe(MATLIB.VE_STR_MAT_LIB_VERSION);
    // Kayda dokunmak katalogu etkilemiyor
    n.data.material.E = 1;
    expect(MATLIB.veStrMatLibById('s355jr').E).toBe(210000);
  });

  test('uygulama sonrası kayıt ÇÖZÜLEBİLİR ve rozet amber', () => {
    const n = mkNode('m1');
    global.nodes = [n];
    str.veStrMatApplyLib('m1', 'aw6082-t6');
    expect(str.veStrMatValidate(n.data.material).ok).toBe(true);
    const bi = str.veStrMatBadgeInfo(n);
    expect(bi.ready).toBe(true);
    // ROZET METNİ: "EN AW-6082 T6" ham kısaltmayla "EN AW-608…" olurdu ve
    // bu BAŞKA BİR ALAŞIM gibi okunur. Standart öneki atılınca ayırt edici
    // parça (6082) ayakta kalıyor.
    expect(bi.text).toBe('AW-6082 T6');
    expect(bi.title).toContain('EN AW-6082 T6');   // tam ad ipucunda
  });

  test('bilinmeyen kimlik kaydı BOZMUYOR', () => {
    const n = mkNode('m1');
    n.data.material = { name: 'elle', E: 1000, nu: 0.3 };
    global.nodes = [n];
    expect(str.veStrMatApplyLib('m1', 'yok-boyle-bir-sey')).toBe(false);
    expect(n.data.material.name).toBe('elle');   // eski kayıt yerinde
  });

  // İZ ÜÇ DURUM anlatıyor ve üçü farklı şey söylüyor. İkisini birleştirmek
  // kullanıcıyı yanıltırdı: katalog adı, artık katalogda olmayan sayıların
  // üstünde durur.
  test('iz satırı: katalogdan geldi / elle değişti / hiç katalogdan gelmedi', () => {
    const n = mkNode('m1');
    global.nodes = [n];

    // 1) hiç katalogdan gelmedi
    str.veStrMatSet('m1', 'E', '210000');
    expect(str.getStrMaterialPropertiesHTML(n)).toContain('kütüphane izi yok');

    // 2) katalogdan geldi, değişmedi
    str.veStrMatApplyLib('m1', '1.4404');
    let h = str.getStrMaterialPropertiesHTML(n);
    expect(h).toContain('Kütüphaneden');
    expect(h).toContain('X2CrNiMo17-12-2');
    expect(h).not.toContain('elle değiştirildi');

    // 3) katalogdan geldi ama elle değişti
    str.veStrMatSet('m1', 'E', '195000');
    h = str.getStrMaterialPropertiesHTML(n);
    expect(h).toContain('elle değiştirildi');
    expect(n.data.material.lib).toBe('1.4404');   // İZ duruyor
    expect(n.data.material.source).toBe('manual');
  });

  test('elle değişen kayıtta katalog kimliği KAYBOLMUYOR', () => {
    // İz atılsaydı \"bu neyden türetildi\" sorusu cevapsız kalırdı.
    const n = mkNode('m1');
    global.nodes = [n];
    str.veStrMatApplyLib('m1', '42crmo4');
    str.veStrMatSet('m1', 'sy', '650');          // d = 100 mm kademesi
    expect(n.data.material.lib).toBe('42crmo4');
    expect(MATLIB.veStrMatLibMatches(n.data.material)).toBe(false);
  });

  test('uzun katalog adları rozette AYIRT EDİCİ parçayı koruyor', () => {
    // Ham kısaltma "EN AC-43000 (AlSi10Mg) T6" için "EN AC-430…" verirdi.
    expect(str._strMatShortName('EN AW-6082 T6')).toBe('AW-6082 T6');
    expect(str._strMatShortName('EN AC-43000 (AlSi10Mg) T6')).toBe('AC-43000 T6');
    expect(str._strMatShortName('EN-GJS-500-7')).toBe('GJS-500-7');
    expect(str._strMatShortName('S355JR')).toBe('S355JR');
    // Kısaltılamayacak kadar uzun olan yine kısalıyor — ama ipucunda tam ad var.
    expect(str._strMatShortName('X5CrNiMo17-12-2')).toBe('X5CrNiMo17…');
  });

  test('liste UYGULANAN kaydı işaretliyor — \"şu an hangisi takılı\"', () => {
    const n = mkNode('m1');
    global.nodes = [n];
    str.veStrMatApplyLib('m1', 'gjs-500-7');
    const h = str.getStrMaterialPropertiesHTML(n);
    expect(h).toMatch(/class="ve-str-mat-row[^"]*applied/);
  });

  test('seçim OTURUMLUK: aynı satıra ikinci tık seçimi kaldırıyor', () => {
    // Bir gezinme tercihi undo yığınına binmemeli (CAD yüz seçimindeki kural).
    const n = mkNode('m1');
    global.nodes = [n];
    str.veStrMatLibPick('m1', 's355jr');
    expect(str.getStrMaterialPropertiesHTML(n)).toContain('Parçaya Uygula');
    str.veStrMatLibPick('m1', 's355jr');          // ikinci tık
    expect(str.getStrMaterialPropertiesHTML(n)).not.toContain('Parçaya Uygula');
    expect(n.data.material).toBeUndefined();      // düğüme HİÇ yazılmadı
  });

  test('seçilenin BÜTÜN sayıları uygulamadan ÖNCE görünüyor', () => {
    // Kullanıcı kör bir kimliğe değil, OKUDUĞU değerlere onay veriyor.
    const n = mkNode('m1');
    global.nodes = [n];
    str.veStrMatLibPick('m1', 'ti-6al-4v');
    const h = str.getStrMaterialPropertiesHTML(n);
    ['113.800', '0,342', '4.430', '880', '950'].forEach((v) => expect(h).toContain(v));
    expect(h).toContain('ASTM B348');             // standart = değerin kaynağı
  });

  test('kaydın UYARISI listede de künyede de görünüyor', () => {
    const n = mkNode('m1');
    global.nodes = [n];
    str.veStrMatLibPick('m1', 'nbr70');
    expect(str.getStrMaterialPropertiesHTML(n)).toContain('UYGUN DEĞİL');
    str.veStrMatLibPick('m1', 'gjl-250');
    expect(str.getStrMaterialPropertiesHTML(n)).toMatch(/AKMA GÖSTERMEZ/);
  });

  test('arama süzgeci listeyi gerçekten daraltıyor', () => {
    const n = mkNode('m1');
    global.nodes = [n];
    const hepsi = str.getStrMaterialPropertiesHTML(n);
    const tumSatir = (hepsi.match(/<button type="button" class="ve-str-mat-row/g) || []).length;
    expect(tumSatir).toBe(MATLIB.VE_STR_MAT_LIB.length);

    str.veStrMatLibQuery('m1', '1.4301');
    const dar = str.getStrMaterialPropertiesHTML(n);
    expect((dar.match(/<button type="button" class="ve-str-mat-row/g) || []).length).toBe(1);
    expect(dar).toContain('X5CrNi18-10');

    str.veStrMatLibQuery('m1', '');
    str.veStrMatLibSetCat('m1', 'titanyum');
    const kat = str.getStrMaterialPropertiesHTML(n);
    expect((kat.match(/<button type="button" class="ve-str-mat-row/g) || []).length).toBe(3);
    str.veStrMatLibSetCat('m1', '');
  });

  test('AİLE BAŞLIKLARI yalnız aranmamış listede — arama sırası PUANA göre', () => {
    // Arama sonucunda başlık basmak sırayı YALANLARDI: orada sıra aileye göre
    // değil eşleşme puanına göre.
    const n = mkNode('m1');
    global.nodes = [n];
    str.veStrMatLibQuery('m1', '');
    const h = str.getStrMaterialPropertiesHTML(n);
    expect(h).toContain('ve-str-mat-head');
    // AİLE BAŞLIĞI SAYISI = AİLE SAYISI. ÖLÇÜLDÜ: sıralama alfabetikken 16
    // aile için 30 başlık basılıyordu — aileler birbirinin içine giriyordu.
    expect((h.match(/class="ve-str-mat-head"/g) || []).length)
      .toBe(MATLIB.VE_STR_MAT_CATS.length);
    str.veStrMatLibQuery('m1', 'celik');
    expect(str.getStrMaterialPropertiesHTML(n)).not.toContain('ve-str-mat-head');
    str.veStrMatLibQuery('m1', '');
  });

  test('panelde undefined/NaN sızmıyor — boş, seçili ve uygulanmış hâlde', () => {
    const n = mkNode('m1');
    global.nodes = [n];
    expect(str.getStrMaterialPropertiesHTML(n)).not.toMatch(/undefined|NaN|\[object/);
    str.veStrMatLibPick('m1', 'al2o3-995');       // σ_ak null olan kayıt
    expect(str.getStrMaterialPropertiesHTML(n)).not.toMatch(/undefined|NaN|\[object/);
    str.veStrMatApplyLib('m1', 'al2o3-995');
    expect(str.getStrMaterialPropertiesHTML(n)).not.toMatch(/undefined|NaN|\[object/);
    str.veStrMatLibPick('m1', 'al2o3-995');
  });

  test('HER kayıt paneli patlatmadan seçilebiliyor ve uygulanabiliyor', () => {
    // 112 kaydın hepsi tek tek: seçim künyesi kuruluyor, uygulama kayıt
    // üretiyor ve kayıt çözülebilir. Bir kaydın eksik alanı paneli
    // patlatırsa burada görünür.
    const n = mkNode('m1');
    global.nodes = [n];
    MATLIB.VE_STR_MAT_LIB.forEach((m) => {
      str.veStrMatLibPick('m1', m.id);
      const h = str.getStrMaterialPropertiesHTML(n);
      expect(h).not.toMatch(/undefined|NaN|\[object/);
      expect(str.veStrMatApplyLib('m1', m.id)).toBe(true);
      expect(str.veStrMatValidate(n.data.material).ok).toBe(true);
      str.veStrMatLibPick('m1', m.id);
    });
  });
});

// ── 5) İSKELET BEŞ DOSYAYA BAĞLI — biri unutulursa kayıt bozulur ────────────
describe('modül kablolaması eksiksiz', () => {
  const oku = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

  test('cp-core.js panel dağıtımı beş tipi de tanıyor', () => {
    const s = oku('js/cp-core.js');
    expect(s).toContain('getStrModulePropertiesHTML');
    ['Geometry', 'Material', 'Mesh', 'BC', 'Results'].forEach((k) => {
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
    ['str-geometry', 'str-material', 'str-mesh', 'str-bc', 'str-results'].forEach((t) => {
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

  test('index.html: malzeme kütüphanesi TEK kez ve cp-structural\'den ÖNCE', () => {
    // Sıra önemli: cp-structural.js panel kurarken kütüphane globallerini
    // okuyor. Sonra yüklenseydi panel ilk açılışta \"kütüphane yüklenmedi\"
    // derdi — sessiz değil ama yanlış.
    const s = oku('index.html');
    expect(s.match(/src="js\/structural-materials\.js"/g)).toHaveLength(1);
    expect(s.indexOf('src="js/structural-materials.js"'))
      .toBeLessThan(s.indexOf('src="js/cp-structural.js"'));
  });

  test('cp-core.js: Malzeme paneli GENİŞ ve kendi pencere sınıfını alıyor', () => {
    const s = oku('js/cp-core.js');
    expect(s).toMatch(/VE_WIDE_PANEL_TYPES[\s\S]{0,1000}'str-material'/);
    expect(s).toContain("'ve-properties--strmat'");
    // Pencere sınıfı KOŞULSUZ: sol sütun (katalog) her zaman dolu, Geometri'deki
    // \"boş açılan büyük pencere\" durumu burada yok.
    expect(s).toMatch(/ve-properties--strmat',\s*node\.type === 'str-material'\)/);
  });

  test('CSS: katalog listesinin boşluğu yutan flex zinciri KESİNTİSİZ', () => {
    // --strgeom'daki dersin aynısı: bir halka (min-height:0 / stretch / flex:1)
    // düşerse panel yine açılır, liste yine görünür — yalnız altında boşluk
    // kalır ve liste kısalır.
    const css = oku('css/styles.css');
    const blok = css.slice(css.indexOf('.ve-properties.ve-properties--strmat'));
    expect(blok).toMatch(/--strmat \.ve-properties-content\{[^}]*overflow:hidden/);
    expect(blok).toMatch(/--strmat \.ve-properties-content > \.sw-panel\{[^}]*min-height:0/);
    expect(blok).toMatch(/--strmat \.ve-str-mat-grid\{[^}]*align-items:stretch/);
    expect(blok).toMatch(/--strmat \.ve-str-mat-grid\{[^}]*min-height:0/);
    expect(blok).toMatch(/--strmat \.ve-str-mat-list\{[^}]*flex:1/);
    // Ve pencere sınıfı --wide'dan SONRA tanımlı olmalı ki onu ezebilsin.
    expect(css.indexOf('.ve-properties.ve-properties--strmat'))
      .toBeGreaterThan(css.indexOf('.ve-properties.ve-properties--wide'));
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

  // ÖLÇÜLDÜ (gerçek tarayıcı, 1600×1000, as1-tu-203): pencere 980×900 iken sol
  // ray 830.6 px, görüntüleyici 540 px — parçanın ALTINDA 290.6 px boşluk.
  // Düzeltme İKİ parçalı ve ikisi de gerekli: pencere büyüyor VE görüntüleyici
  // artan boyu yutuyor. Yalnız birincisi yapılsaydı boşluk BÜYÜRDÜ.
  //
  // Kapı burada string arıyor çünkü kırılma sessiz: flex zincirinin bir
  // halkası (min-height:0, stretch, flex:1) düşse ya da kutuya satır içi bir
  // `height` geri gelse panel yine açılır, parça yine görünür — yalnız boşluk
  // geri gelir. Gerçek ölçüm E2E'de (structural-geometry.spec.js).
  test('Geometri paneli parça YÜKLÜYKEN büyür, boşken büyümez', () => {
    const s = oku('js/cp-core.js');
    // Sınıf koşullu: boş panelde 94vh'lik pencere bomboş açılırdı.
    expect(s).toMatch(/ve-properties--strgeom'[\s\S]{0,220}node\.data\.geometry/);
    // --wide de veriliyor; --strgeom onu EZMELİ → CSS'te SONRA tanımlı olmalı.
    const css = oku('css/styles.css');
    expect(css.indexOf('.ve-properties.ve-properties--strgeom'))
      .toBeGreaterThan(css.indexOf('.ve-properties.ve-properties--wide'));
  });

  test('3B kutunun ölçüsü SINIFTA — satır içi height boşluğu geri getirirdi', () => {
    const s = oku('js/cp-structural.js');
    // Kutu yalnız sınıfla kuruluyor; satır içi stil özgüllükte sınıfı ezerdi.
    expect(s).toMatch(/id="ve-str-geom-wrap" class="ve-str-vwr-box"/);
    expect(s).not.toMatch(/ve-str-geom-wrap"[^>]*style=/);
    // Grid ve sütunlar işaretli olmalı — flex zinciri bu kancalardan geçiyor.
    expect(s).toContain('ve-str-geom-grid');
    expect(s).toContain('ve-str-col-in');
    expect(s).toContain('ve-str-col-out');
  });

  test('boşluğu yutan flex zinciri KESİNTİSİZ — her halka CSS\'te', () => {
    const css = oku('css/styles.css');
    const blok = css.slice(css.indexOf('.ve-properties.ve-properties--strgeom'));
    // pencere → içerik → sw-panel → grid → sağ sütun → kutu
    expect(blok).toMatch(/--strgeom \.ve-properties-content\{[^}]*overflow:hidden/);
    expect(blok).toMatch(/--strgeom \.ve-properties-content > \.sw-panel\{[^}]*min-height:0/);
    expect(blok).toMatch(/--strgeom \.ve-str-geom-grid\{[^}]*align-items:stretch/);
    expect(blok).toMatch(/--strgeom \.ve-str-geom-grid\{[^}]*min-height:0/);
    expect(blok).toMatch(/--strgeom \.ve-str-col-in,\s*\.ve-properties--strgeom \.ve-str-col-out\{[^}]*min-height:0/);
    expect(blok).toMatch(/--strgeom \.ve-str-vwr-box\{[^}]*flex:1[^}]*height:auto/);
  });

  // ── Kullanıcı isteği: üç varsayılan ─────────────────────────────────────
  // (1) CAD yüz listesi ve fare künyesi KAPALI gelsin, (2) ağ inceliği hep
  // "İnce" olsun, (3) kenarlar hep açık olsun. Üçü de KALDIRILMIŞ bir kontrol
  // ya da KAPATILMIŞ bir varsayılan — yani sessizce geri gelebilir: bir kontrol
  // geri eklenirse ya da kip kapalı yerine açık başlarsa panel yine çalışır,
  // yalnız kullanıcının istemediği şeyi yapar.
  test('ağ inceliği SEÇİCİSİ yok — sabit ve en ince', () => {
    const s = oku('js/cp-structural.js');
    expect(s).toContain('VE_STR_MESH_LINEAR = 0.0005');
    // Kademe listesi ve onu değiştiren yol tamamen kalktı.
    expect(s).not.toContain('VE_STR_QUALITY');
    expect(s).not.toContain('veStrGeomSetQuality');
    expect(s).not.toContain('geomQuality');
    // İçe aktarma sabiti KULLANIYOR — sabit tanımlanıp yolda başka bir sayı
    // yazılsaydı test yine yeşil kalırdı.
    expect(s).toMatch(/deflection: \{ type: 'bounding_box_ratio', linear: VE_STR_MESH_LINEAR/);
  });

  test('"Kenarlar" aç/kapa kutusu yok — kenarlar hep açık', () => {
    const s = oku('js/cp-structural.js');
    expect(s).not.toContain('veStrViewerToggleEdges');
    expect(s).not.toMatch(/type="checkbox"/);
    // Görüntüleyici de artık böyle bir kapı sunmuyor (ölü API bırakmıyoruz).
    expect(oku('js/cp-structural-viewer.js')).not.toContain('function veStrViewerToggleEdges');
  });

  test('yüz inceleme kipi KAPALI başlar ve liste ile künyeyi BİRLİKTE açar', () => {
    const s = oku('js/cp-structural.js');
    // Kip oturumluk — seçimle aynı gerekçe (undo yığınına binmesin).
    expect(s).toMatch(/var _veStrFaceMode = \{\};/);
    expect(s).not.toMatch(/node\.data\.faceMode/);
    // Anahtar tek: hem listeyi hem 3B künyesini çeviriyor.
    expect(s).toMatch(/veStrGeomToggleFaceMode[\s\S]{0,900}veStrViewerSetFaceMode/);
    expect(s).toMatch(/veStrGeomToggleFaceMode[\s\S]{0,900}ve-str-face-block/);
    // Kapanınca seçim de gider.
    expect(s).toMatch(/veStrGeomToggleFaceMode[\s\S]{0,400}delete _veStrSelFace\[nodeId\]/);
    // Kanvas ipucu kipe bağlı — kapalıyken "üstüne gel → CAD yüzü" yalan olurdu.
    expect(s).toMatch(/function _strViewerHintHTML\(faceMode\)[\s\S]{0,220}if\(faceMode\)/);
    // Liste gövdesi varsayılan GİZLİ.
    expect(s).toMatch(/id="ve-str-face-block"'\s*\+\s*\(acik \? '' : ' style="display:none;"'\)/);
    // Görüntüleyici her kurulduğunda kip yeniden bildiriliyor.
    expect(s).toMatch(/veStrViewerInit[\s\S]{0,400}veStrViewerSetFaceMode\(veStrGeomFaceMode\(nodeId\)\)/);
  });

  test('kip kapalıyken görüntüleyici raycast bile yapmıyor', () => {
    // Erken çıkış yalnız görsel değil: kapalıyken kare başına bir raycast
    // yapılmıyor. Kapı `faceMode` denetiminin raycaster'dan ÖNCE olmasını arar.
    const v = oku('js/cp-structural-viewer.js');
    const oh = v.slice(v.indexOf('function onHover'), v.indexOf('function onLeave'));
    expect(oh.indexOf('!W.faceMode')).toBeGreaterThan(-1);
    expect(oh.indexOf('!W.faceMode')).toBeLessThan(oh.indexOf('setFromCamera'));
    // Tıkla-seç de kipe bağlı: liste gizliyken tıklamanın görünür karşılığı yok.
    expect(v).toMatch(/drag\.btn === 0[\s\S]{0,80}\)\{/);
    expect(v).toContain('W.faceMode && drag');
    // Kapatınca üç işaret de siliniyor.
    expect(v).toMatch(/function veStrViewerSetFaceMode[\s\S]{0,500}_svwMarkFace\('hl'[\s\S]{0,200}_svwMarkFace\('sel'/);
  });

  test('proje değişince içe aktarılmış geometri UNUTULUYOR', () => {
    // Takoz/FEAD'deki tuzağın aynısı: temizlenmezse yeni projede önceki
    // projenin parçası görüntüleyicide durur.
    const s = oku('js/cp-structural.js');
    expect(s).toMatch(/_strForgetResults[\s\S]{0,900}veStrGeomCacheClear/);
    expect(s).toMatch(/_strForgetResults[\s\S]{0,900}veStrViewerDispose/);
    // HACİM AĞI da oturumluk ve aynı sebeple temizlenmeli: künye hafif,
    // ağın kendisi (yüz binlerce sayı) node.data'ya hiç yazılmıyor.
    expect(s).toMatch(/_strForgetResults[\s\S]{0,900}veStrMeshCacheClear/);
    // Ağ worker'ı da bırakılmalı — canlı bir worker + derlenmiş WASM örneği
    // proje değişince boşuna yaşamaya devam ederdi.
    expect(s).toMatch(/_strForgetResults[\s\S]{0,900}veStrMeshForget/);
    // Oturumluk görünüm durumları da: düğüm kimlikleri yeniden kullanılırsa
    // önceki projenin açık kipi ve seçili yüzü yeni projede durur.
    expect(s).toMatch(/_strForgetResults[\s\S]{0,1200}_veStrSelFace = \{\}/);
    expect(s).toMatch(/_strForgetResults[\s\S]{0,1200}_veStrFaceMode = \{\}/);
  });

  test('Hesaplama Ağı zinciri BEŞ dosyaya birden bağlı — biri unutulursa ağ hiç kurulmaz', () => {
    // Geometri iskeletindeki dersin aynısı: bir bileşen tek dosyada yaşamıyor.
    const html = oku('index.html');
    ['js/structural-remesh.js', 'js/structural-mesh-model.js',
     'js/structural-tetgen-wasm.js', 'vendor/tetgen-wasm.js'].forEach((f) => {
      expect(html).toContain(f);
    });
    // Köprü, remesh'ten SONRA yüklenmeli (worker kaynağını ondan okuyor).
    // Karşılaştırma SCRIPT ETİKETİNE göre: dosya adı yorumlarda da geçiyor ve
    // ham `indexOf` oradaki ilk geçişi bulup sırayı yanlış ölçerdi.
    expect(html.indexOf('src="js/structural-remesh.js"'))
      .toBeLessThan(html.indexOf('src="js/structural-mesh-model.js"'));
    // Panel açılınca 3B görüntüleyici kancası kurulu (cp-core.js).
    expect(oku('js/cp-core.js')).toContain('veStrMeshMountViewer');
  });

  test('CI, TetGen .wasm ve lisansını Pages\'e kopyalıyor', () => {
    // Gömülü varlık PRİMER yol; vendor dosyası eski tarayıcı yedeği ve
    // AGPL-3 kaynağının yanında dağıtılan ikili.
    const ci = oku('.github/workflows/ci-deploy.yml');
    expect(ci).toContain('vendor/tetgen-wasm.wasm');
    expect(ci).toContain('vendor/license.tetgen.txt');
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
