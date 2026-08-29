/**
 * guide-kit.test.js — KULLANIM KILAVUZU KİTİ (js/guide-kit.js)
 *
 * Kit, modül kılavuzlarının ortak altyapısı: kayıt defteri, şeritten açılan
 * seçim penceresi ve belgelerin paylaştığı HTML kabuğu.
 *
 * Kapıların çoğu tek bir hata sınıfını hedefliyor: **kılavuz üretilir, indirilir,
 * hiçbir hata çıkmaz — ama rapordan bambaşka görünür.** Kozmetik gömülü rapor
 * şablonundan çalışma anında çıkarıldığı için bu sınıf gerçek: şablonun yapısı
 * değişirse çıkarma yanlış bloğu alabilir. `_gkReportCss` bu yüzden sessizce
 * varsayılana DÜŞMEZ, atar; testler hem olumlu hem OLUMSUZ dalı tutuyor.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const stubs = stubGlobals();
global.window = global;

// Gömülü rapor şablonu — kozmetik ORADAN çıkarılıyor, kopyalanmıyor.
eval(loadSource('fead-report-template.js'));

const KIT = require('../../js/guide-kit.js');
Object.keys(KIT).forEach((k) => { global[k] = KIT[k]; });

const RIBBON_SRC = fs.readFileSync(path.join(ROOT, 'js/ribbon.js'), 'utf8');
const INDEX_SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const COMPONENTS_SRC = fs.readFileSync(path.join(ROOT, 'js/components.js'), 'utf8');

beforeEach(() => resetStubs(stubs));

// ═══════════════════════════════════════════════════════════════════════════
describe('kayıt defteri', () => {
  test('dört modülün dördü de kayıtlı ve kimlikler tekil', () => {
    expect(KIT.VE_GUIDE_KIT).toHaveLength(4);
    const ids = KIT.VE_GUIDE_KIT.map((k) => k.id);
    expect(new Set(ids).size).toBe(4);
    expect(ids).toEqual(expect.arrayContaining(['fead', 'arac', 'mount', 'str']));
  });

  test('her kayıt zorunlu alanların hepsini taşıyor', () => {
    KIT.VE_GUIDE_KIT.forEach((k) => {
      ['id', 'modul', 'baslik', 'ozet', 'uret', 'dosya'].forEach((alan) => {
        expect(typeof k[alan]).toBe('string');
        expect(k[alan].length).toBeGreaterThan(0);
      });
      // Dosya adı indirmede kullanılıyor: yol ayırıcı ya da boşluk olmamalı.
      expect(k.dosya).toMatch(/^[\w.-]+$/);
    });
  });

  test('veGuideKitOf bilinmeyen kimlikte null döner, uydurmaz', () => {
    expect(KIT.veGuideKitOf('yok')).toBeNull();
    expect(KIT.veGuideKitOf('fead').modul).toBe('FEAD');
  });

  test('üreticisi yüklenmemiş kayıt HAZIR sayılmaz', () => {
    // "Düğmeyi çiz, tıklayınca hiçbir şey olmasın" bu depoda kabul edilmeyen
    // sonuç: kayıt defteri yalnız bir AD taşıyor, o adı taşıyan fonksiyon
    // yoksa kılavuz henüz yazılmamıştır.
    const sahte = { id: 'x', uret: 'veGuideOlmayanHTML' };
    expect(KIT.veGuideKitReady(sahte)).toBe(false);
    global.veGuideOlmayanHTML = () => '<html></html>';
    expect(KIT.veGuideKitReady(sahte)).toBe(true);
    delete global.veGuideOlmayanHTML;
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('hangi modüldeyiz', () => {
  afterEach(() => { delete global.veSidebarScope; delete global.veGuideFeadHTML; });

  test('kapsam adları js/components.js ile BİREBİR aynı', () => {
    // İki yerde ayrı yazılsalardı biri sessizce eskir ve yanlış kılavuz
    // açılırdı. veSyncSidebarScope'un yazdığı dört ad kaynaktan okunuyor.
    const blok = COMPONENTS_SRC.slice(
      COMPONENTS_SRC.indexOf('function veSyncSidebarScope'),
      COMPONENTS_SRC.indexOf('function veSyncSidebarScope') + 900
    );
    const kaynak = (blok.match(/scope = '([a-z-]+)'/g) || [])
      .map((s) => s.replace(/scope = '|'/g, ''))
      .filter((s) => s !== 'top');
    expect(kaynak.length).toBe(4);
    kaynak.forEach((ad) => {
      expect(Object.keys(KIT.VE_GUIDE_SCOPE_MAP)).toContain(ad);
    });
    expect(Object.keys(KIT.VE_GUIDE_SCOPE_MAP)).toHaveLength(4);
  });

  test('modül dışındayken null', () => {
    global.veSidebarScope = 'top';
    expect(KIT.veGuideCurrentId()).toBeNull();
  });

  test('FEAD içindeyken ve üretici yüklüyken fead', () => {
    global.veSidebarScope = 'fead-analysis';
    global.veGuideFeadHTML = () => '<html></html>';
    expect(KIT.veGuideCurrentId()).toBe('fead');
  });

  test('kılavuzu YAZILMAMIŞ modülde null — düğme hiç çizilmesin', () => {
    global.veSidebarScope = 'structural-analysis';
    expect(KIT.veGuideCurrentId()).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('kozmetik şablondan çıkarılır (ikinci kopya yok)', () => {
  const tpl = () => decodeURIComponent(escape(atob(window.FEAD_REPORT_TEMPLATE_B64)));

  test('gerçek şablondan raporun kozmetik bloğu geliyor', () => {
    const css = KIT._gkReportCss(tpl());
    expect(css.length).toBeGreaterThan(3000);
    // Raporun görsel dilinin dört imzası — biri eksikse yanlış blok alınmıştır.
    expect(css).toContain('--prusya');
    expect(css).toContain('.antet');
    expect(css).toContain('.appfig');
    expect(css).toContain('@media print');
  });

  test('çıkarılan blok @@ASSETS_CSS@@ yer tutucusunu İÇERMEZ', () => {
    // Birinci <style> bloğu alınsaydı belge fontsuz ve kozmetiksiz çıkardı.
    expect(KIT._gkReportCss(tpl())).not.toContain('@@ASSETS_CSS@@');
  });

  test('şablonda tek <style> varsa SESSİZCE düşmez, atar', () => {
    expect(() => KIT._gkReportCss('<style>body{}</style><body></body>'))
      .toThrow(/kozmetik <style> bloğu bulunamadı/);
  });

  test('ikinci blok kozmetik DEĞİLSE atar', () => {
    // "Makul ama yanlış" sınıfı: blok bulunur, belge üretilir, yalnız
    // bambaşka görünür. Bu yüzden içerik de doğrulanıyor.
    expect(() => KIT._gkReportCss('<style>a{}</style><style>b{color:red}</style>'))
      .toThrow(/rapor kozmetiği değil/);
  });

  test('veGuideDocHTML varlıklar yokken sessiz kalmaz', () => {
    const yedek = window.MNT_REPORT_ASSETS;
    delete window.MNT_REPORT_ASSETS;
    expect(() => KIT.veGuideDocHTML({ title: 'x', body: '' }))
      .toThrow(/varlıkları yüklenmedi/);
    if (yedek) window.MNT_REPORT_ASSETS = yedek;
  });

  test('belge kabuğu raporun iskeletini kurar', () => {
    window.MNT_REPORT_ASSETS = { fontsCss: '/* font */' };
    const h = KIT.veGuideDocHTML({ title: 'Deneme', body: '<p>gövde</p>' });
    expect(h.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(h).toContain('<html lang="tr">');
    expect(h).toContain('<title>Deneme</title>');
    expect(h).toContain('<div class="page">');
    expect(h).toContain('--prusya');
    expect(h.trim().endsWith('</html>')).toBe(true);
    // KaTeX KİTAPLIĞI GEÇMEZ: kılavuzda denklem yok, özet raporun 944→340 KB
    // kararının aynısı. Ölçüt kitaplığın kendisi — şablonun kozmetik bloğunda
    // `.katex-display` diye bir CSS KURALI var ve o kalır (kopyalanan blok
    // raporun bloğunun ta kendisi); yasak olan çalıştırılabilir kod.
    expect(h).not.toContain('@@KATEX_JS@@');
    expect(h).not.toMatch(/<script/i);
    delete window.MNT_REPORT_ASSETS;
  });

  test('başlık kaçışlanıyor', () => {
    window.MNT_REPORT_ASSETS = { fontsCss: '' };
    const h = KIT.veGuideDocHTML({ title: '<script>x</script>', body: '' });
    expect(h).not.toContain('<title><script>');
    expect(h).toContain('&lt;script&gt;');
    delete window.MNT_REPORT_ASSETS;
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('yapı taşları raporun sınıflarını kullanır', () => {
  test('antet .band + .fields üretir', () => {
    const h = KIT.veGuideAntet({
      eyebrow: 'ÜST', h1: 'Başlık', sub: 'alt',
      fields: [['a', '1'], ['b', '2']]
    });
    expect(h).toContain('class="antet"');
    expect(h).toContain('class="band"');
    expect(h).toContain('class="eyebrow"');
    expect(h).toContain('class="fields"');
    expect((h.match(/class="f"/g) || []).length).toBe(2);
  });

  test('içindekiler ve h2 rozeti', () => {
    expect(KIT.veGuideToc([['x', '1', 'Bir']])).toContain('<a href="#x"><span class="n">1</span>Bir</a>');
    expect(KIT.veGuideH2('x', '1', 'Bir')).toBe('<h2 id="x"><span class="no">1</span>Bir</h2>');
  });

  test('not kutusu üç türü de destekler ve gövdeyi HAM geçirir', () => {
    expect(KIT.veGuideNote('', 'E', '<b>x</b>')).toContain('class="note"');
    expect(KIT.veGuideNote('warn', 'E', 'x')).toContain('class="note warn"');
    expect(KIT.veGuideNote('check', 'E', 'x')).toContain('class="note check"');
    // Gövde HAM: kalın/kod/liste geçsin diye. Başlık ise kaçışlanır.
    expect(KIT.veGuideNote('', '<i>', '<b>x</b>')).toContain('<b>x</b>');
    expect(KIT.veGuideNote('', '<i>', 'x')).toContain('&lt;i&gt;');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('şerit bağı', () => {
  test('iki komut da şeritte tanımlı', () => {
    expect(RIBBON_SRC).toContain("run:'veGuideKitOpen'");
    expect(RIBBON_SRC).toContain("run:'veGuideOpenCurrent'");
    expect(RIBBON_SRC).toContain("label: 'Kullanım Kılavuzları'");
  });

  test('ikisi de VE_RIBBON_ALWAYS_ON içinde', () => {
    // js/guide-kit.js'in kendi kuralı: "kılavuz çözülmüş model istemez; tuval
    // bomboşken — hatta karşılama ekranındayken — okunabilir olmak zorundadır."
    // Muafiyet olmazsa veRibbonItemEnabled tam o anda düğmeyi PASİF çizer ve
    // kural yüzeyde yazılı, davranışta yok olur.
    const blok = RIBBON_SRC.slice(
      RIBBON_SRC.indexOf('var VE_RIBBON_ALWAYS_ON'),
      RIBBON_SRC.indexOf('];', RIBBON_SRC.indexOf('var VE_RIBBON_ALWAYS_ON'))
    );
    expect(blok).toContain('veGuideKitOpen');
    expect(blok).toContain('veGuideOpenCurrent');
  });

  test('kapsam değişince şerit yeniden çizilir', () => {
    // veGuideCurrentId kapsamdan okuyor; kapsamı yazan tek yer
    // veSyncSidebarScope. Orada şerit tazelenmezse "Bu Modülün Kılavuzu"
    // düğmesi modüle girer girmez belirmez — bir sonraki rastgele tazelemeye
    // kadar yanlış durumda kalır.
    const i = COMPONENTS_SRC.indexOf('function veSyncSidebarScope');
    const blok = COMPONENTS_SRC.slice(i, COMPONENTS_SRC.indexOf('\n}', i));
    expect(blok).toContain('veRibbonRender');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('index.html kaydı', () => {
  // ÖLÇÜLDÜ: js/ klasörünü index.html ile karşılaştıran başka hiçbir kapı yok.
  // Dosya yazılıp buraya eklenmezse `npm test` de `npm run build` de YEŞİL
  // kalır, ama tek dosya sürümünde fonksiyon bulunmaz ve şerit düğmesi
  // devre dışı çizilir — sessiz başarısızlık.
  ['js/guide-kit.js', 'js/guide-fead.js'].forEach((yol) => {
    test(yol + ' index.html’de kayıtlı ve ertelemeli yükleniyor', () => {
      const re = new RegExp('<script type="text/x-mfsim-defer" src="' + yol.replace('/', '\\/') + '"');
      expect(re.test(INDEX_SRC)).toBe(true);
    });
  });

  test('guide-kit, guide-fead’den ÖNCE yükleniyor', () => {
    // Kılavuz üreticileri kabuğun yardımcılarını (veGuideDocHTML, veGuideH2…)
    // çağırıyor. Çağrı anında çözüldükleri için sıra teknik bir zorunluluk
    // değil, ama tersi okuyucuyu yanıltır ve ileride bir üst-seviye çağrı
    // eklenirse sessizce kırılır.
    expect(INDEX_SRC.indexOf('src="js/guide-kit.js"'))
      .toBeLessThan(INDEX_SRC.indexOf('src="js/guide-fead.js"'));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('pencere kartı', () => {
  afterEach(() => { delete global.veGuideFeadHTML; });

  test('hazır olmayan kılavuz "hazırlanıyor" der, düğme çizmez', () => {
    const kart = KIT._gkKart(KIT.veGuideKitOf('str'));
    expect(kart).toContain('HAZIRLANIYOR');
    expect(kart).toContain('henüz yazılmadı');
    expect(kart).not.toContain('veGuideOpen(');
  });

  test('hazır kılavuz Aç ve İndir düğmelerini çizer', () => {
    global.veGuideFeadHTML = () => '<html></html>';
    const kart = KIT._gkKart(KIT.veGuideKitOf('fead'));
    expect(kart).toContain('>HAZIR<');
    expect(kart).toContain("veGuideOpen('fead')");
    expect(kart).toContain("veGuideDownload('fead')");
  });

  test('kart sayısı kayıt defterinden gelir', () => {
    expect(KIT.veGuideKitCount()).toBe(0);
    global.veGuideFeadHTML = () => '<html></html>';
    expect(KIT.veGuideKitCount()).toBe(1);
  });
});
