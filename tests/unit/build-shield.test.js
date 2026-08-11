/**
 * build-shield.test.js
 * ────────────────────
 * Tek dosya build'inin "erken kapanan script bloğu" kapısı.
 *
 * OLAY (2026-08): js/results.js'e KaTeX gömülürken üç ham `</script>` girdi.
 * index.html'de hiçbir şey olmadı — modüller orada HARİCİ dosya, içerikleri
 * HTML'i ilgilendirmiyor. Ama MFSim_Code.html'de aynı içerik bir `<script>`
 * etiketinin İÇİNE giriyor: HTML ayrıştırıcısı ilk `</script` dizisinde bloğu
 * KAPATTI, kalan ~90 KB kaynak HTML olarak ayrıştırıldı. Sonuç, kullanıcının
 * ekranında:
 *   • `' + '` ve `' + emptyName + ' boş` gibi ham kod parçaları,
 *   • gövdeye giren `<div class="ve-trace-empty">` ekranı kaplayıp tüm
 *     tıklamaları yuttu → "hiçbir yere tıklayamıyorum",
 *   • results.js'in kalanı sözdizimi hatası verdi, Sonuçlar paneli yüklenmedi.
 *
 * Hiçbir birim testi bunu göremezdi: testler js/ dosyalarını DOĞRUDAN yükler,
 * MFSim_Code.html'e hiç bakmaz. Kapı bu yüzden burada — davranışı değil,
 * GÖMME DÖNÜŞÜMÜNÜ test ediyor.
 *
 * Not: MFSim_Code.html git'e dahil değil (build üretir), bu yüzden test üretilen
 * dosyaya değil, üreten mantığa (build-shield.js) ve KAYNAKLARA bakar.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SHIELD = require('../../build-shield.js');

const ROOT = path.join(__dirname, '../..');

function jsFiles(dir) {
  return fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort()
    .map(f => ({ rel: path.relative(ROOT, path.join(dir, f)), abs: path.join(dir, f) }));
}

describe('shieldScriptEnd — gömülen JS bloğu erken kapatamaz', () => {
  test('ham "</script>" kaçırılır, dizgenin DEĞERİ değişmez', () => {
    const src = `var doc = '<script>' + katexJs + '</script>';`;
    const { code, escaped } = SHIELD.shieldScriptEnd(src, 'ornek.js');

    expect(escaped).toBe(1);
    expect(/<\/script/i.test(code)).toBe(false);   // artık bloğu kapatamaz

    // ASIL İDDİA: kaçış davranışı değiştirmedi — üretilen dizge aynı.
    const ctx = { katexJs: 'KATEX' };
    vm.createContext(ctx);
    vm.runInContext(code, ctx);
    expect(ctx.doc).toBe('<script>KATEX</script>');
  });

  test('yorum içindeki "</script>" de kaçırılır (olayın kök nedeni buydu)', () => {
    const src = `// KaTeX gövdesindeki "</script>" bloğu erken kapatır\nvar x = 1;`;
    const { code, escaped } = SHIELD.shieldScriptEnd(src, 'ornek.js');
    expect(escaped).toBe(1);
    expect(/<\/script/i.test(code)).toBe(false);
  });

  test('büyük harfli "</SCRIPT>" de yakalanır — HTML etiket adı harfe duyarsız', () => {
    const { code, escaped } = SHIELD.shieldScriptEnd(`var a = '</SCRIPT>';`, 'ornek.js');
    expect(escaped).toBe(1);
    expect(/<\/script/i.test(code)).toBe(false);
  });

  test('temiz kaynağa dokunulmaz', () => {
    const src = `var a = 1;\n// hiçbir tuzak yok\n`;
    const { code, escaped } = SHIELD.shieldScriptEnd(src, 'ornek.js');
    expect(escaped).toBe(0);
    expect(code).toBe(src);
  });

  test('kaçış sözdizimini bozarsa SESSİZ GEÇMEZ, hata fırlatır', () => {
    // Kaçış yalnızca dizge/regex/yorum içinde güvenli. Dışarıda bir yerde
    // "</script" varsa üretilen kod derlenmez — build durmalı, bozuk dosya
    // yazmamalı.
    expect(() => SHIELD.shieldScriptEnd('var a = </script;', 'bozuk.js')).toThrow();
  });
});

describe('countScriptElements — tarayıcının göreceği script sayısı', () => {
  test('düz sayım', () => {
    expect(SHIELD.countScriptElements('<script>a</script><script>b</script>')).toBe(2);
  });

  test('gövdesinde ham "</script>" olan belge, eleman sayısıyla KANDIRABİLİR', () => {
    // Kapının ilk yazımı yalnızca eleman sayısını kıyaslıyordu. Aşağıdaki
    // belge bozuk (ilk blok dizgenin içinde erken kapanıyor) ama eleman sayısı
    // tesadüfen doğru çıkıyor: kalan "</script>" metne düşüyor, sonraki
    // "<script>" yeni bir eleman açıyor. Bu yüzden eleman sayısı TEK BAŞINA
    // yeterli bir kapı değildir — asıl kanıt kapanış sayısıdır (sonraki test).
    const bozuk = '<script>var a = "</script>";</script><script>var b = 2;</script>';
    expect(SHIELD.countScriptElements(bozuk)).toBe(2);   // kandırdı
  });

  test('gömülü CSS içindeki "<script" sahte alarm üretmez', () => {
    // <style> ham metin kipidir: içindeki '<' etiket başlatmaz. Sayaç bunu
    // atlamazsa build her seferinde boşuna kırmızıya döner.
    const src = '<style>.a::after{content:"<script>"}</style><script>var a=1;</script>';
    expect(SHIELD.countScriptElements(src)).toBe(1);
  });

  test('HTML yorumundaki "<script" sayılmaz', () => {
    expect(SHIELD.countScriptElements('<!-- <script>eski</script> --><script>a</script>')).toBe(1);
  });

  test('Türkçe "İ" indeksleri kaydırmaz (toLowerCase tuzağı)', () => {
    // 'İ'.toLowerCase() iki karakterdir ('i' + U+0307): dizgeyi küçülterek
    // arama yapan bir sayaç burada YANLIŞ konum bulur. İlk yazımda tam olarak
    // bu oldu ve kapı sahte alarm verdi.
    expect('İ'.toLowerCase().length).toBe(2);              // tuzağın kendisi
    const src = '<script>// İÇE AKTARMA İŞLEMİ İPTAL\nvar a=1;</script><script>var b=2;</script>';
    expect(SHIELD.countScriptElements(src)).toBe(2);
  });
});

describe('verifyScriptBlocks — asıl kapı', () => {
  test('sağlam belge geçer', () => {
    const saglam = '<script>var a = "x";</script><script>var b = 2;</script>';
    expect(SHIELD.verifyScriptBlocks(saglam, 2)).toBeNull();
  });

  test('gövdedeki ham "</script>" YAKALANIR — eleman sayısı kandırsa bile', () => {
    // Bir üstteki testin kandırdığı belge. Kapanış sayısı (3) eleman sayısını
    // (2) aşıyor: erken kapanmanın doğrudan kanıtı.
    const bozuk = '<script>var a = "</script>";</script><script>var b = 2;</script>';
    expect(SHIELD.countScriptClosers(bozuk)).toBe(3);
    expect(SHIELD.verifyScriptBlocks(bozuk, 2)).toMatch(/ERKEN KAPATIYOR/);
  });

  test('2026-08 olayının birebir küçük ölçeği yakalanır', () => {
    // js/results.js'in kırılan üç satırının özü: KaTeX <script> etiketlerini
    // düz dizge olarak yazmak. Kalkandan geçmeden gömülürse kapı tutmalı.
    const kaynak =
      `// KaTeX gövdesinde geçen "</script>" dizisi bloğu erken kapatır\n` +
      `var doc = '<script>' + katexJs + '</script>';\n` +
      `var bos = '<div class="ve-trace-empty" style="display:flex;">' + ad + ' boş</div>';\n`;

    const kalkansiz = '<script>\n' + kaynak + '\n</script>';
    expect(SHIELD.verifyScriptBlocks(kalkansiz, 1)).toMatch(/ERKEN KAPATIYOR/);

    const kalkanli = '<script>\n' + SHIELD.shieldScriptEnd(kaynak, 'results.js').code + '\n</script>';
    expect(SHIELD.verifyScriptBlocks(kalkanli, 1)).toBeNull();
  });

  test('eleman sayısı beklenenden saparsa ayrı mesaj verir', () => {
    expect(SHIELD.verifyScriptBlocks('<script>a</script>', 2)).toMatch(/beklenenden farklı/);
  });
});

describe('script gövdesinin ham metin KİPLERİ — tarayıcıyla birebir', () => {
  // Aşağıdaki beklentilerin HEPSİ gerçek Chromium'da ölçüldü (bkz. PR gövdesi).
  // Kapının ilk yazımı kipleri modellemiyordu ve "<!-- + <script" durumunu
  // temiz diye geçiriyordu: tarayıcı orada TEK bir script elemanı görüyor ve
  // belgenin geri kalanını yutuyor — sayfa bomboş açılıyordu.

  test('"<!--" sonrası "<script" varsa kapanış etiketi KAPATMAZ (double escaped)', () => {
    const bozuk = '<script>\nvar a=1;\n<!-- y\nvar t="<script src=x>";\n</script>' +
                  '<script>window.B=1;</script>';
    // Chromium: 1 eleman, sonrası yutulur.
    expect(SHIELD.scanDocument(bozuk).scripts).toBe(1);
    expect(SHIELD.scanDocument(bozuk).unclosed).toEqual(['script']);
    expect(SHIELD.verifyScriptBlocks(bozuk, 2)).toMatch(/HİÇ KAPANMIYOR/);
  });

  test('"<!--" tek başına zararsız — kapanış hâlâ kapatır', () => {
    const saglam = '<script>\nvar a=1;\n<!-- y\n</script><script>window.B=1;</script>';
    expect(SHIELD.scanDocument(saglam).scripts).toBe(2);
    expect(SHIELD.verifyScriptBlocks(saglam, 2)).toBeNull();
  });

  test('"-->" escaped kipten çıkarır, tuzak dağılır', () => {
    const saglam = '<script>\nvar a=1;\n<!-- y\nvar t="<script src=x>";\n-->\n</script>' +
                   '<script>window.B=1;</script>';
    expect(SHIELD.scanDocument(saglam).scripts).toBe(2);
    expect(SHIELD.verifyScriptBlocks(saglam, 2)).toBeNull();
  });

  test('kalkan "<!--" zincirini keser — build kendiliğinden kurtarır', () => {
    // Gerçekçi vaka ve olayın tekrarı: tuzağı ANLATAN bir yoruma "<!--" yazmak.
    const kaynak = '// HTML yorumu "<!--" ile başlar; script gövdesinde tehlikeli.\n' +
                   'var t = "<script src=x>";\n';
    const { code, escaped } = SHIELD.shieldScriptEnd(kaynak, 'ornek.js');
    expect(escaped).toBeGreaterThan(0);
    expect(code.indexOf('<!--')).toBe(-1);
    expect(SHIELD.verifyScriptBlocks('<script>\n' + code + '\n</script>', 1)).toBeNull();
  });

  test('"<!--" ESKİ tarz JS yorumu olarak kullanılmışsa build SESSİZ GEÇMEZ', () => {
    // Annex B: satır başındaki "<!--" sloppy-mode JS'te tek satırlık yorumdur.
    // Kaçırmak sözdizimini bozar — kalkan bunu yeniden derleyerek yakalar ve
    // fırlatır. Build durur; yanlış dosya üretilip yayınlanmaz.
    expect(() => SHIELD.shieldScriptEnd('var a=1;\n<!-- eski yorum\nvar b=2;\n', 'eski.js'))
      .toThrow();
  });

  test('kapanış "</script" + boşluk ve + "/" de kapatır — sadece ">" aramak yetmez', () => {
    for (const son of [' ', '/', '>']) {
      const bozuk = '<script>\nvar s="</script' + son + '";\n</script><script>window.B=1;</script>';
      expect(SHIELD.verifyScriptBlocks(bozuk, 2)).not.toBeNull();
    }
  });

  test('attribute değerindeki ">" açılış etiketini erken bitirmez', () => {
    const saglam = '<script type="text/x-mfsim-defer" data-l="a > b">var a=1;</script>' +
                   '<script>window.B=1;</script>';
    expect(SHIELD.scanDocument(saglam).scripts).toBe(2);
    expect(SHIELD.verifyScriptBlocks(saglam, 2)).toBeNull();
  });

  test('BELGE düzeyindeki HTML yorumunda "</script>" sahte alarm üretmez', () => {
    const saglam = '<!-- <script>eski</script> --><script>window.B=1;</script>' +
                   '<script>var q=1;</script>';
    expect(SHIELD.countScriptClosers(saglam)).toBe(3);   // ham sayaç: yorumu da sayar
    expect(SHIELD.scanDocument(saglam).stray).toBe(0);   // konum duyarlı: öksüz yok
    expect(SHIELD.verifyScriptBlocks(saglam, 2)).toBeNull();
  });

  test('script GÖVDESİNDEKİ "<!--" bir yorum DEĞİL — gerçek erken kapanma yutulmaz', () => {
    // Bu, kapının kendisinde açılıp kapanan bir delik. Gövdede "<!--" görünce
    // tokenizer escaped kipe girer ama "</script>" o kipte HÂLÂ KAPATIR.
    // Kapının ara sürümü <!--…--> aralığını regex'le maskeliyordu ve bu gerçek
    // kırılmayı "temiz" diye geçiriyordu. Gerçek Chromium'la ölçüldü:
    // ikinci blok çalışıyor ama ilk bloğun kalanı gövdeye METİN olarak
    // dökülüyor ve window.SONRA hiç tanımlanmıyor.
    const bozuk =
      '<script>var a=1;\n<!-- x\nvar s="</script>";\n-->\nwindow.SONRA=1;\n</script>' +
      '<script>window.B=1;</script>';
    expect(SHIELD.scanDocument(bozuk).stray).toBe(1);    // öksüz kapanış = imza
    expect(SHIELD.verifyScriptBlocks(bozuk, 2)).toMatch(/ÖKSÜZ/);
  });

  test('<style> gövdesindeki "</script>" de sahte alarm üretmez', () => {
    const saglam = '<style>.a::after{content:"</script>"}</style><script>var a=1;</script>';
    expect(SHIELD.verifyScriptBlocks(saglam, 1, 1)).toBeNull();
  });
});

describe('rapor üreticileri kapanışı tam kurala göre kaçırıyor', () => {
  // İndirilen HTML raporlara KaTeX gömen iki yer. Kaçış ">" zorunlu tutarsa
  // "</script " ve "</script/" biçimleri sızar ve raporda formül yerine yüz
  // binlerce karakter ham JS görünür. KaTeX gövdesi upstream'den yeniden
  // üretiliyor (tools/report-assets/) — sürüm yükseltmesinde içerik değişir.
  test.each([
    ['js/results.js', path.join(ROOT, 'js/results.js')],
    ['js/cp-mount-report.js', path.join(ROOT, 'js/cp-mount-report.js')],
  ])('%s katexJs kaçışı ">" zorunlu tutmuyor', (rel, abs) => {
    const src = fs.readFileSync(abs, 'utf8');
    const m = src.match(/katexJs\s*=\s*[^;]*?\.replace\((\/[^/]+\/[gi]*)/);
    expect(m).not.toBeNull();
    expect(m[1]).not.toMatch(/script>/);   // ">" ZORUNLU OLMAMALI
  });
});

describe('kaynaklar tek dosyaya gömülünce sağlam kalıyor', () => {
  // Uçtan uca iddia: kalkandan geçirilen HER kaynak, bir <script> bloğunun
  // içine konduğunda TAM OLARAK bir eleman üretir. Bu test, kaynağa yeni bir
  // ham "</script>" girse bile kalkanın onu tuttuğunu ölçer.
  const targets = [
    ...jsFiles(path.join(ROOT, 'js')),
    ...jsFiles(path.join(ROOT, 'viewer/js')),
  ];

  test.each(targets.map(t => [t.rel, t.abs]))('%s tek blok olarak gömülüyor', (rel, abs) => {
    const raw = fs.readFileSync(abs, 'utf8');
    const { code } = SHIELD.shieldScriptEnd(raw, rel);
    expect(SHIELD.countScriptElements('<script>\n' + code + '\n</script>')).toBe(1);
  });

  test('gömülen CSS <style> bloğunu erken kapatmıyor', () => {
    const cssDir = path.join(ROOT, 'css');
    for (const f of fs.readdirSync(cssDir).filter(f => f.endsWith('.css'))) {
      const css = fs.readFileSync(path.join(cssDir, f), 'utf8');
      const { code } = SHIELD.shieldStyleEnd(css);
      expect({ file: f, raw: /<\/style/i.test(code) }).toEqual({ file: f, raw: false });
    }
  });
});

describe('örnek topolojiler gövdeye BOZULMADAN gömülüyor', () => {
  // build.js, gömülen JSON'u <body> etiketinin ardına String.replace ile
  // enjekte ediyor. İKİNCİ argüman DİZGE olursa, içindeki '$1'..'$9', '$&',
  // "$'", '$`' ve '$$' ÖZEL DİZİ sayılıp genişletilir — yani örnek adında bir
  // '$' geçtiği anda ad SESSİZCE değişir. Ölçülen bozulma:
  //   "Motor $1 Takoz" → "Motor  class=… Takoz"   (yakalama grubu)
  //   "A$&B"           → "A<body …>B"             (tüm eşleşme)
  //   "C$$D"           → "C$D"                    (kaçırılmış $)
  // Fonksiyon replacer'da bu genişletme HİÇ yapılmaz.
  const build = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');

  test('build.js gövde enjeksiyonunda FONKSİYON replacer kullanıyor', () => {
    const m = /html\s*=\s*html\.replace\(\s*\/<body[^/]*\/\s*,\s*([\s\S]{0,30})/.exec(build);
    expect(m).not.toBeNull();
    expect(m[1]).toMatch(/function\s*\(/);
  });

  test('dizge replacer bozar, fonksiyon replacer bozmaz (davranış kanıtı)', () => {
    const json = JSON.stringify({ 'a.json': { name: 'Motor $1 Takoz', b: 'A$&B', c: 'C$$D' } });
    const betik = '<script>window.__MNT_TOPOLOGIES = ' + json + ';<\/script>';
    const html = '<body class="x">';

    const dizgeyle = html.replace(/<body([^>]*)>/, '<body$1>\n' + betik);
    expect(dizgeyle.indexOf(json)).toBe(-1);            // BOZULDU

    const fonksiyonla = html.replace(/<body([^>]*)>/, function (m, attrs) {
      return '<body' + attrs + '>\n' + betik;
    });
    expect(fonksiyonla.indexOf(json)).toBeGreaterThan(-1);   // AYNEN KORUNDU
    expect(fonksiyonla).toContain('<body class="x">');       // attribute da yerinde
  });
});

describe('gömülmemiş kaynak kapısı', () => {
  // Tek dosya ürününde kalan her göreli src/href, indirilen dosyada 404 verir
  // ve program SESSİZCE yarım açılır. Kapı iki ayrı yere bakmak zorunda: ham
  // metin blokları DIŞINDA etiketlere, <style> gövdelerinin İÇİNDE url(...)'a.

  test('script gövdesindeki JS dizgesi sahte alarm üretmez', () => {
    // Ölçüldü: MFSim_Code.html'de onlarca "href=\"' + url + '\"" gibi dizge
    // var; gövdeyi maskelemeyen bir arama hepsini eksik kaynak sanardı.
    const html = '<script>var a = \'<a href="\' + url + \'">\';</script>';
    expect(SHIELD.leftoverRefs(html, [])).toEqual({ attrs: [], cssUrls: [] });
  });

  test('gerçek bir göreli öznitelik yakalanır (tek ve çift tırnak)', () => {
    expect(SHIELD.leftoverRefs('<img src="logo.png">', []).attrs).toEqual(['logo.png']);
    expect(SHIELD.leftoverRefs("<link href='fav.ico'>", []).attrs).toEqual(['fav.ico']);
  });

  test('uzantı süzgeci YOK — .js/.css dışı da yakalanır', () => {
    // Eski kapı yalnız .js/.css biliyordu; .png/.ico/.woff2/uzantısız yollar
    // aynı 404'ü verdiği hâlde sessizce geçiyordu.
    const html = '<img src="a.png"><link href="b.woff2"><a href="c">x</a>';
    expect(SHIELD.leftoverRefs(html, []).attrs).toEqual(['a.png', 'b.woff2', 'c']);
  });

  test('data:, #, mutlak adres ve mailto harici sayılmaz', () => {
    const html = '<img src="data:image/png;base64,AA"><a href="#x">a</a>' +
                 '<a href="https://ornek.test/y">b</a><a href="//cdn/z">c</a>' +
                 '<a href="mailto:a@b.c">d</a>';
    expect(SHIELD.leftoverRefs(html, [])).toEqual({ attrs: [], cssUrls: [] });
  });

  test('gömülü CSS içindeki url(...) YAKALANIR — asıl kaçak buydu', () => {
    // Gerçek olay: vendored leaflet.css üç göreli görsele başvuruyordu. CSS
    // satır içine alınınca yollar SAYFAYA göre çözülüyor ve <site>/images/...
    // oluyor; canlı yayında ölçüldü, üçü de HTTP 404. Eski kapı CSS'e hiç
    // bakmıyordu.
    const html = '<style>.a{background-image:url(images/layers.png)}</style>';
    expect(SHIELD.leftoverRefs(html, []).cssUrls).toEqual(['images/layers.png']);
  });

  test('CSS içindeki data: URI ve #çapa sahte alarm üretmez', () => {
    const html = '<style>.a{background:url(data:image/gif;base64,AA)}' +
                 '.b{behavior:url(#default#VML)}</style>';
    expect(SHIELD.leftoverRefs(html, []).cssUrls).toEqual([]);
  });

  test('izinli listedeki dış dosyalar geçer', () => {
    const html = '<link rel="manifest" href="pwa/manifest.json">';
    expect(SHIELD.leftoverRefs(html, ['pwa/manifest.json']).attrs).toEqual([]);
    expect(SHIELD.leftoverRefs(html, []).attrs).toEqual(['pwa/manifest.json']);
  });

  test('kaldırılan Leaflet görselleri gerçekten kullanılmıyor', () => {
    // Üç görsel, yalnız iki Leaflet özelliği kullanılırsa çizilir:
    //   L.control.layers  → .leaflet-control-layers-toggle (layers.png)
    //   L.Icon.Default    → .leaflet-default-icon-path     (marker-icon.png)
    // MFSim yalnız L.divIcon kullanıyor. Biri eklenirse görsel yeniden gerekir
    // ve o an bu kapı öter — kaldırma kararı sessizce yanlışa dönmesin.
    const js = fs.readdirSync(path.join(ROOT, 'js'))
      .filter((f) => f.endsWith('.js'))
      .map((f) => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'))
      .join('\n');
    expect(js).not.toMatch(/L\.control\.layers/);
    expect(js).not.toMatch(/L\.Icon\.Default/);
  });

  test('vendored CSS\'te göreli görsel başvurusu KALMADI', () => {
    // Kaldırılan üç başvurunun geri sızmasına karşı doğrudan kapı.
    const cssDir = path.join(ROOT, 'vendor');
    for (const f of fs.readdirSync(cssDir).filter((x) => x.endsWith('.css'))) {
      const css = fs.readFileSync(path.join(cssDir, f), 'utf8');
      const goreli = [...css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)]
        .map((m) => m[2].trim())
        .filter((v) => !/^(data:|#|https?:|\/\/)/i.test(v));
      expect({ dosya: f, goreli }).toEqual({ dosya: f, goreli: [] });
    }
  });
});

describe('iki build de kalkanı KULLANIYOR', () => {
  // Kalkan koda girmiş ama çağrılmıyorsa hiçbir şey korumaz. Bu, "kapı hâlâ
  // takılı mı" sorusunun testi.
  test.each([
    ['build.js', path.join(ROOT, 'build.js')],
    ['viewer/build.js', path.join(ROOT, 'viewer/build.js')],
  ])('%s hem kalkanı hem yapısal doğrulamayı çağırıyor', (rel, abs) => {
    const src = fs.readFileSync(abs, 'utf8');
    expect(src).toMatch(/require\((['"])[.\/]*build-shield\.js\1\)/);
    expect(src).toMatch(/shieldScriptEnd\(/);      // girdi kalkanı
    expect(src).toMatch(/shieldStyleEnd\(/);       // stil kalkanı
    expect(src).toMatch(/verifyScriptBlocks\(/);   // çıktı kapısı
  });
});
