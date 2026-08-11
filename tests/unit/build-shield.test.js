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

describe('iki build de kalkanı KULLANIYOR', () => {
  // Kalkan koda girmiş ama çağrılmıyorsa hiçbir şey korumaz. Bu, "kapı hâlâ
  // takılı mı" sorusunun testi.
  test.each([
    ['build.js', path.join(ROOT, 'build.js')],
    ['viewer/build.js', path.join(ROOT, 'viewer/build.js')],
  ])('%s hem kalkanı hem yapısal doğrulamayı çağırıyor', (rel, abs) => {
    const src = fs.readFileSync(abs, 'utf8');
    expect(src).toMatch(/require\((['"])[.\/]*build-shield\.js\1\)/);
    expect(src).toMatch(/shieldScriptEnd\(/);
    expect(src).toMatch(/countScriptElements\(/);
  });
});
