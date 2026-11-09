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
  test('üç modülün üçü de kayıtlı ve kimlikler tekil', () => {
    expect(KIT.VE_GUIDE_KIT).toHaveLength(3);
    const ids = KIT.VE_GUIDE_KIT.map((k) => k.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids).toEqual(expect.arrayContaining(['fead', 'arac', 'mount']));
  });

  test('her kayıt zorunlu alanların hepsini taşıyor', () => {
    KIT.VE_GUIDE_KIT.forEach((k) => {
      ['id', 'modul', 'baslik', 'uret', 'dosya'].forEach((alan) => {
        expect(typeof k[alan]).toBe('string');
        expect(k[alan].length).toBeGreaterThan(0);
      });
      // Dosya adı indirmede kullanılıyor: yol ayırıcı ya da boşluk olmamalı.
      expect(k.dosya).toMatch(/^[\w.-]+$/);
    });
  });

  test('kayıt açıklama yuvası taşımaz — kart yalnız ad ve durum basar', () => {
    // ARAYÜZ ANLATMAZ: kalıp bir açıklama alanı açarsa her kullanan onu doldurur.
    // Eski `ozet` alanı üç kartta üç açıklama cümlesi basıyordu ("Sonunda uçtan
    // uca işlenmiş bir örnek.").
    KIT.VE_GUIDE_KIT.forEach((k) => {
      ['ozet', 'not', 'alt', 'aciklama'].forEach((alan) => expect(k[alan]).toBeUndefined());
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
    // açılırdı. veSyncSidebarScope'un yazdığı üç ad kaynaktan okunuyor.
    const blok = COMPONENTS_SRC.slice(
      COMPONENTS_SRC.indexOf('function veSyncSidebarScope'),
      COMPONENTS_SRC.indexOf('function veSyncSidebarScope') + 900
    );
    const kaynak = (blok.match(/scope = '([a-z-]+)'/g) || [])
      .map((s) => s.replace(/scope = '|'/g, ''))
      .filter((s) => s !== 'top');
    expect(kaynak.length).toBe(3);
    kaynak.forEach((ad) => {
      expect(Object.keys(KIT.VE_GUIDE_SCOPE_MAP)).toContain(ad);
    });
    expect(Object.keys(KIT.VE_GUIDE_SCOPE_MAP)).toHaveLength(3);
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

  test('üreticisi YÜKLENMEMİŞ modülde null — düğme hiç çizilmesin', () => {
    // Kayıt defterinde var ama `uret` adını taşıyan fonksiyon ortada yok:
    // düğmeyi çizip tıklayınca hiçbir şey olmaması sessiz başarısızlıktır.
    global.veSidebarScope = 'mount-analysis';
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
    expect(css).toContain('--vurgu');
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
    // Kılavuzun gerek duyduğu tek varlık raporun ŞABLONU (kozmetik bloğu
    // oradan kopyalanıyor). Yüz artık rapor paketinden değil arayüzün kendi
    // @font-face kurallarından geliyor — paket yokken de belge kurulur.
    const yedek = window.FEAD_REPORT_TEMPLATE_B64;
    delete window.FEAD_REPORT_TEMPLATE_B64;
    try {
      expect(() => KIT.veGuideDocHTML({ title: 'x', body: '' }))
        .toThrow(/varlıkları yüklenmedi/);
    } finally { if (yedek) window.FEAD_REPORT_TEMPLATE_B64 = yedek; }
  });

  test('belge kabuğu raporun iskeletini kurar', () => {
    const eskiYuz = global.veThemeFontFaceCss;
    global.veThemeFontFaceCss = () => '/* arayüz yüzü */';
    let h;
    try { h = KIT.veGuideDocHTML({ title: 'Deneme', body: '<p>gövde</p>' }); }
    finally { global.veThemeFontFaceCss = eskiYuz; }
    // Yüz ARAYÜZÜN kurallarından gömülü (rapor paketinden değil).
    expect(h).toContain('/* arayüz yüzü */');
    expect(h.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(h).toContain('<html lang="tr">');
    expect(h).toContain('<title>Deneme</title>');
    expect(h).toContain('<div class="page">');
    expect(h).toContain('--vurgu');
    expect(h.trim().endsWith('</html>')).toBe(true);
    // KaTeX KİTAPLIĞI GEÇMEZ: kılavuzda denklem yok, özet raporun 944→340 KB
    // kararının aynısı. Ölçüt kitaplığın kendisi — şablonun kozmetik bloğunda
    // `.katex-display` diye bir CSS KURALI var ve o kalır (kopyalanan blok
    // raporun bloğunun ta kendisi); yasak olan çalıştırılabilir kod.
    expect(h).not.toContain('@@KATEX_JS@@');
    expect(h).not.toMatch(/<script/i);
  });

  test('başlık kaçışlanıyor', () => {
    const h = KIT.veGuideDocHTML({ title: '<script>x</script>', body: '' });
    expect(h).not.toContain('<title><script>');
    expect(h).toContain('&lt;script&gt;');
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
    expect(RIBBON_SRC).toContain("label: 'Kullanım kılavuzları'");
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
// İŞARETLER (kullanıcı 2026-11-09: "bol bol görseller ile, yönlendirmeler ile,
// işaretler ile kullanıcı hep bilgilendirilmeli"): rozet ÖĞEYE bağlı, numara
// dizideki sıra, lejant aynı diziden, bulunamayan hedef SESSİZ değil.
describe('İŞARETLER — şekil, lejant, metin aynı numarayı taşır', () => {
  const PANEL = '<div class="ve-fp-govde">'
    + '<section class="ve-fp-card"><div class="ve-fp-sect"><b>Kütle</b><span>[kg]</span></div>'
    + '<label>Kütle <input id="m" value="1"></label></section>'
    + '<section class="ve-fp-card"><div class="ve-fp-sect"><b>Konum</b></div><p>x</p></section>'
    + '<div class="ve-fp-yurut"><button type="button">Hesapla</button></div></div>';

  test('üç tanım yolu (seçici · bölüm · metin) öğeyi bulur ve rozeti İÇİNE koyar', () => {
    const r = KIT.veGuideIsaretle(PANEL, [
      { bolum: 'Konum', ad: 'Konum' },
      { metin: 'Hesapla', ad: 'Hesapla', yer: 'sag' },
      { s: '.ve-fp-yurut', ad: 'Eylem satırı' },
    ]);
    expect(r.kayip).toEqual([]);
    const d = document.createElement('div');
    d.innerHTML = r.html;
    const hedef = [...d.querySelectorAll('.gk-hedef')];
    expect(hedef.map((h) => h.getAttribute('data-gk-no'))).toEqual(['1', '3', '2']);
    // bölüm → bölümün KARTI (section), başlık satırı değil
    expect(hedef[0].tagName).toBe('SECTION');
    expect(hedef[0].querySelector(':scope > .gk-no').textContent).toBe('1');
    // metin → yazısı tam o olan EN DERİN öğe (düğme, kabı değil)
    const btn = d.querySelector('button.gk-hedef');
    expect(btn.querySelector('.gk-no.gk-no--sag').textContent).toBe('2');
    expect(r.lejant.map((l) => l.no + ':' + l.ad)).toEqual(['1:Konum', '2:Hesapla', '3:Eylem satırı']);
  });

  test('içine öğe alamayan hedef (alan) rozeti ebeveynine verir', () => {
    const r = KIT.veGuideIsaretle(PANEL, [{ s: '#m', ad: 'Kütle alanı' }]);
    const d = document.createElement('div');
    d.innerHTML = r.html;
    expect(d.querySelector('input .gk-no')).toBeNull();
    expect(d.querySelector('label.gk-hedef > .gk-no').textContent).toBe('1');
  });

  test('bulunamayan hedef SESSİZ değil: lejant yine yazılır, kayıp listeye düşer', () => {
    KIT.veGuideSceneReset();
    const h = KIT.veGuideScene(PANEL, 'alt', 400, [
      { bolum: 'Kütle', ad: 'Kütle' },
      { bolum: 'Olmayan bölüm', ad: 'Hayalet' },
    ]);
    expect(KIT.veGuideIsaretKayip()).toEqual([{ sekil: 1, ad: 'Hayalet' }]);
    expect(h).toContain('<ol class="gk-lejant');
    expect((h.match(/<li>/g) || []).length).toBe(2);
    expect(h).toContain('gk-sahne gk-sahne--isaret');
    // sıra: kutu → lejant → altyazı
    expect(h.indexOf('gk-lejant')).toBeGreaterThan(h.indexOf('gk-sahne'));
    expect(h.indexOf('<figcaption>')).toBeGreaterThan(h.indexOf('gk-lejant'));
    KIT.veGuideSceneReset();
    expect(KIT.veGuideIsaretKayip()).toEqual([]);
  });

  test('işaretsiz sahne eskisi gibi: lejant yok, dolgu sınıfı yok', () => {
    KIT.veGuideSceneReset();
    const h = KIT.veGuideScene(PANEL, 'alt', 400);
    expect(h).not.toContain('gk-lejant');
    expect(h).not.toContain('gk-sahne--isaret');
    expect(h).not.toContain('gk-hedef');
  });

  test('metin içindeki numara şekildekiyle aynı biçimde', () => {
    expect(KIT.veGuideNo(3)).toBe('<span class="gk-no gk-no--metin">3</span>');
  });

  test('ekran görüntüsü şekli: kutu ve rozet YÜZDEYLE, eksik anahtar kayıp', () => {
    KIT.veGuideSceneReset();
    const resim = { src: 'data:image/webp;base64,AA', g: 1000, y: 500,
      isaret: { a: [0.1, 0.2, 0.3, 0.4], b: [0.5, 0.5, 0.6, 0.7] } };
    const h = KIT.veGuideEkran(resim, [
      { k: 'a', ad: 'Bir' }, { k: 'b', ad: 'İki', yer: 'sag' }, { k: 'yok', ad: 'Üç' },
    ], 'Ekran');
    expect(h).toContain('left:10%; top:20%; width:20%; height:20%;');
    expect(h).toContain('data-gk-no="1" style="left:10%; top:20%;"');
    expect(h).toContain('data-gk-no="2" style="left:60%; top:50%;"');     // sağ üst köşe
    expect(h).not.toContain('data-gk-no="3"');
    expect(KIT.veGuideIsaretKayip()).toEqual([{ sekil: 1, ad: 'Üç' }]);
    expect((h.match(/<li>/g) || []).length).toBe(3);
    expect(h).toContain('<b>Şekil 1 —</b> Ekran');
    expect(KIT.veGuideEkran(null, [], 'x')).toBe('');
  });

  // Küçük yazıda köşedeki rozet ilk harfi örtüyordu (hızlı atamanın kartı): dışarıdaki
  // yerler; yanlış yazılmış yer sessizce sol üst köşeye düşerdi.
  test('ekran görüntüsü: rozet öğenin dışında durabilir, bilinmeyen yer kayıp, görüntü büyütülmez', () => {
    KIT.veGuideSceneReset();
    const resim = { src: 'data:image/webp;base64,AA', g: 400, y: 200, isaret: { a: [0.5, 0.5, 0.75, 0.6] } };
    const h = KIT.veGuideEkran(resim, [
      { k: 'a', ad: 'Üstte', yer: 'ust' },
      { k: 'a', ad: 'Solda', yer: 'sol-dis' },
      { k: 'a', ad: 'Yanlış', yer: 'sag-dıs' },
    ], 'Küçük', 600);
    expect(h).toContain('max-width:400px;');                                   // 400 px görüntü 600'e büyümez
    expect(h).toContain('data-gk-no="1" style="left:52.25%; top:44.5%;"');     // +9 px, 11 px üstte
    expect(h).toContain('data-gk-no="2" style="left:47.25%; top:55%;"');       // 11 px solda, ortada
    expect(h).toContain('data-gk-no="3" style="left:50%; top:50%;"');
    expect(KIT.veGuideIsaretKayip()).toEqual([{ sekil: 1, ad: 'Yanlış · yer: sag-dıs' }]);
    KIT.veGuideSceneReset();
    // canlı sahnenin yerleri ayrı liste: ekranınki orada bilinmeyen yerdir
    const r = KIT.veGuideIsaretle(PANEL, [{ s: '.ve-fp-yurut', ad: 'Eylem satırı', yer: 'ust' }]);
    expect(r.kayip).toEqual(['Eylem satırı · yer: ust']);
    expect(r.html).toContain('gk-no gk-no--sol');
    // canlı sahnenin her yeri ekranda da aynı adla
    expect(KIT.VE_GUIDE_ISARET_YER.filter((y) => KIT.VE_GUIDE_EKRAN_YER.indexOf(y) < 0)).toEqual([]);
  });

  test('sahne stili: hedefin konum kuralı programınkinden ÖNCE, rozet kuralları SONRA', () => {
    const st = document.createElement('style');
    st.textContent = '.ve-fp-card{position:absolute}.ve-ak-zem{fill:#fff}';
    document.head.appendChild(st);
    try {
      const css = KIT.veGuideSceneCSS('', ['.ve-ak']);
      const hedef = css.indexOf('.appfig .gk-hedef{position:relative;}');
      const program = css.indexOf('.appfig .ve-fp-card{position:absolute}');
      expect(hedef).toBeGreaterThan(-1);
      expect(program).toBeGreaterThan(hedef);
      expect(css.indexOf('.gk-lejant{')).toBeGreaterThan(program);
      // kılavuza özgü önek: seçicinin İÇİNDE aranır
      expect(css).toContain('.appfig .ve-ak-zem{fill:#fff}');
      expect(KIT.veGuideSceneCSS('')).not.toContain('.ve-ak-zem');
    } finally { st.remove(); }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('pencere kartı', () => {
  afterEach(() => { delete global.veGuideFeadHTML; });

  test('üreticisi yüklenmemiş kılavuz "hazırlanıyor" der, düğme çizmez', () => {
    // Kayıt defterindeki `uret` yalnız bir AD; o adı taşıyan fonksiyon yoksa
    // (bu testte veGuideMountHTML tanımlı değil) kart düğme çizmemeli.
    const kart = KIT._gkKart(KIT.veGuideKitOf('mount'));
    expect(kart).toContain('>Hazırlanıyor<');
    // Rozet durumu söyler; ikinci bir cümle aynı şeyi tekrar etmez.
    expect(kart).not.toContain('henüz yazılmadı');
    expect(kart).not.toContain('veGuideOpen(');
  });

  // LİSTE (Canlı Not 91: "yapısı güzel değil, butonlar kocaman"): kılavuz başına tek
  // satır, Aç · İndir küçük düğme; hazır kılavuzda rozet yok (önce "Hazır").
  test('hazır kılavuz tek satır: ad, Aç ve İndir; rozet yok', () => {
    global.veGuideFeadHTML = () => '<html></html>';
    const kart = KIT._gkKart(KIT.veGuideKitOf('fead'));
    expect(kart).not.toContain('>Hazır<');
    expect(kart).toMatch(/^<div class="ve-gk-satir"><span class="ve-gk-ad">FEAD — Kayış-kasnak sistemi<\/span><span class="ve-gk-eylem">/);
    expect(kart).not.toMatch(/style="/);
    expect(kart).toContain("veGuideOpen('fead')");
    expect(kart).toContain("veGuideDownload('fead')");
  });

  test('kart sayısı kayıt defterinden gelir', () => {
    expect(KIT.veGuideKitCount()).toBe(0);
    global.veGuideFeadHTML = () => '<html></html>';
    expect(KIT.veGuideKitCount()).toBe(1);
  });
});
