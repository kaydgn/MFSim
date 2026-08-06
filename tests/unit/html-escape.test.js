// ── Kullanıcı metni HTML'e ham gömülmez ──────────────────────────────────────
//
// Uygulamada üç ayrı serbest metin var ve üçü de PROJE DOSYASINA yazılıyor:
//   • bileşen adı   (node.customName — özellik panelinden)
//   • sekme adı     (prompt('Sekme adı:'))
//   • nokta adı     (harita üzerindeki waypoint)
// Ayrıca içe aktarılan Excel/CSV'nin SÜTUN BAŞLIKLARI da serbest metin.
//
// Proje dosyası paylaşılıyor: bir meslektaşın .json'unu açmak o adları bu
// sayfaya taşır. Ham gömüldüklerinde iki şey oluyordu:
//   1. '<' içeren bir ad arayüzü sessizce bozuyor — metnin bir parçası
//      görünmez oluyor, kullanıcı neye baktığını bilemiyordu.
//   2. Sütun başlığı örneğinde ölçüldü: <img src=x onerror="..."> gerçekten
//      DOM'a giriyor ve onerror ÇALIŞIYORDU.
//
// Bu dosya kaçış çağrılarının YERİNDE DURDUĞUNU sınar. Bir HTML dizesinin
// içeriğini değil, tehlikeli birleştirmenin geri gelmediğini kontrol eder —
// yani etiket değişince kırılmaz, kaçış kalkınca kırılır.

const fs = require('fs');
const path = require('path');

const JS = path.join(__dirname, '../../js');
const oku = (f) => fs.readFileSync(path.join(JS, f), 'utf8');

// Kaynak dosyada "HTML dizesi + IFADE" biçiminde kaçışsız birleştirme arar.
// Yorum satırları elenir (bu dosyanın da anlattığı örnekler orada duruyor).
function hamGomulenler(src, alanlar) {
  const kod = src
    .split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    .join('\n');
  const re = new RegExp(
    `['"][^'"\\n]*<[^'"\\n]*['"]\\s*\\+\\s*([A-Za-z_$][\\w.$]*\\.(?:${alanlar.join('|')})\\b)`,
    'g'
  );
  const bulunan = [];
  let m;
  while ((m = re.exec(kod)) !== null) bulunan.push(m[1]);
  return bulunan;
}

describe('kullanıcı metni HTML kaçışından geçer', () => {
  const durumlar = [
    ['results.js', ['name', 'unit', 'group'], 'X ekseni listesi, tablo başlıkları, sekme çubuğu'],
    ['topology.js', ['name'], 'topoloji sekme çubuğu'],
    ['solver.js', ['label'], 'doğrulama listesi (bileşen adı taşır)'],
    ['map.js', ['name'], 'harita nokta balonu'],
  ];

  durumlar.forEach(([dosya, alanlar, nerede]) => {
    test(`${dosya} — ${nerede}`, () => {
      const kalan = hamGomulenler(oku(dosya), alanlar);
      // Beyaz liste: veri kaynaklı OLMAYAN, uygulama sabiti alanlar.
      const izinli = /^(pkg|s|c|item|tab)\.(name|label)$/;
      const suclu = kalan.filter((x) => !izinli.test(x));
      expect(suclu).toEqual([]);
    });
  });

  test('escapeHTML gerçekten kaçırıyor — kimliğe dönen bir stub değil', () => {
    // Bu iddia olmadan yukarıdaki testler, escapeHTML boş bir sarmalayıcı
    // olsa bile geçerdi.
    expect(escapeHTML('<img src=x onerror="a">')).toBe(
      '&lt;img src=x onerror=&quot;a&quot;&gt;');
    expect(escapeHTML("Basinc & 'kapali'")).toBe('Basinc &amp; &#39;kapali&#39;');
    expect(escapeHTML('düz metin')).toBe('düz metin');
  });

  test('sayı ve null escapeHTML\'i çökertmez', () => {
    // Alanlar her zaman string değil; kaçış çağrısı onları olduğu gibi geçirmeli.
    expect(escapeHTML(42)).toBe(42);
    expect(escapeHTML(null)).toBe(null);
    expect(escapeHTML(undefined)).toBe(undefined);
  });
});
