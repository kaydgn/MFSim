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

  test('İSKELET DEĞİL — \"Bileşen bekleniyor\" demiyor, kütüphaneyi SIRAYA koyuyor', () => {
    // _strPending işareti \"bu panel henüz çalışmıyor\" demek ve iskelet sayacı
    // ona bakıyor; çalışan bir panelde kullanmak o sayacı bozardı.
    const h = mk();
    expect(h).not.toContain('Bileşen bekleniyor');
    expect(h).toContain('Sırada');
    expect(h).toContain('malzeme kütüphanesi');
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
