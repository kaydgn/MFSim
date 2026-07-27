/**
 * Tema tutarlılık testi
 * ─────────────────────
 * Bir tema üç yerde birden kayıtlı olmalı:
 *   • js/theme.js   → `valid` dizisi (geçersiz temayı 'slate'e düşürür)
 *   • js/settings.js→ Ayarlar > Görünüm menüsü ({ id, name } listeleri)
 *   • css/styles.css→ [data-theme="id"] { --bg-primary: ... } bloğu
 *
 * Biri diğerinden kayarsa (örn. menüde görünüp CSS'i olmayan tema) uygulama
 * sessizce 'slate'e döner — gözle yakalanmayan "makul ama yanlış" regresyon.
 * Bu test o senkronu şimdi ve gelecekteki tema eklemeleri için korur.
 * (theme.js'in kendi yorumu da bu üçlü senkronu zorunlu kılar.)
 */
const fs = require('fs');
const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '../../', f), 'utf8');

const css = read('css/styles.css');
const themeJs = read('js/theme.js');
const settingsJs = read('js/settings.js');

const uniqSort = (arr) => Array.from(new Set(arr)).sort();

// theme.js: var valid = ['slate','cream',...];
const validIds = uniqSort(
  ((themeJs.match(/var valid = \[([^\]]+)\]/) || [])[1] || '')
    .match(/'([^']+)'/g).map((s) => s.replace(/'/g, ''))
);

// settings.js: { id: 'x', name: '...' } — bu kalıbı yalnız tema listeleri kullanır
const settingsIds = uniqSort(
  [...settingsJs.matchAll(/\{\s*id:\s*'([^']+)',\s*name:/g)].map((m) => m[1])
);

// styles.css'te bir temanın DEĞİŞKEN bloğunu döndürür (yoksa '').
// `[data-theme="x"]` birden çok kuralda geçebildiği için (ör. bileşen
// override'ları) --bg-primary tanımlayan blok aranır — ilk eşleşme değil.
const themeBlock = (id) => {
  const re = new RegExp('\\[data-theme="' + id + '"\\][^{]*\\{([^}]*)\\}', 'g');
  for (const m of css.matchAll(re)) {
    if (/--bg-primary\s*:/.test(m[1])) return m[1];
  }
  return '';
};

describe('tema kimlikleri üç kaynakta senkron', () => {
  test('en az bir tema bulundu (regex kayması erken yakalansın)', () => {
    expect(validIds.length).toBeGreaterThan(0);
    expect(settingsIds.length).toBeGreaterThan(0);
  });

  test('theme.js `valid` == settings.js menüsü', () => {
    expect(validIds).toEqual(settingsIds);
  });

  test('her tema kimliğinin styles.css bloğu ve --bg-primary tanımı var', () => {
    const missing = validIds.filter((id) => !themeBlock(id));
    expect(missing).toEqual([]);
  });

  test('Donanma Mavisi (navy) her üç kaynakta mevcut', () => {
    expect(validIds).toContain('navy');
    expect(settingsIds).toContain('navy');
    expect(css).toContain('[data-theme="navy"]');
  });
});

describe('tema görsel bütünlüğü', () => {
  /* `color-scheme` bildirilmezse tarayıcı kendi çizdiği kontrolleri (select
     açılır listesi, sayı okları, onay kutusu, kaydırma çubuğu) AÇIK renkte
     verir; koyu temada koyu bir <select>'e tıklayınca bembeyaz liste açılır.
     Gözle ancak açılır liste açılınca fark edilir → teste değer. */
  test('her tema bloğu color-scheme bildiriyor', () => {
    const missing = validIds.filter((id) => !/color-scheme\s*:\s*(dark|light)/.test(themeBlock(id)));
    expect(missing).toEqual([]);
  });

  /* Hover/seçim vurguları aktif aksandan türemeli. Sabit mavi tonlar,
     aksanı turuncu/altın/kırmızı olan temalarda mavi leke olarak kalır. */
  test('styles.css içinde sabit-mavi vurgu tonu kalmadı', () => {
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, ''); // yorumlar hariç
    expect(rules).not.toMatch(/rgba\(\s*59\s*,\s*130\s*,\s*246/);
  });

  /* settings.js'teki tema önizleme pulu, o temanın styles.css'teki gerçek
     --bg-primary / --bg-tertiary / --accent-primary değerlerini göstermeli;
     palet değişip pul eskiyse kullanıcı yanlış rengi görerek seçim yapar. */
  test('tema pulu renkleri styles.css paletiyle aynı', () => {
    const swatches = [...settingsJs.matchAll(
      /\{\s*id:\s*'([^']+)',\s*name:\s*'[^']*',\s*swatch:\s*\[([^\]]+)\]/g
    )].map((m) => [m[1], m[2].match(/'([^']+)'/g).map((c) => c.replace(/'/g, ''))]);

    expect(swatches.length).toBe(validIds.length);

    const mismatched = swatches.filter(([id, colors]) => {
      const block = themeBlock(id);
      const varOf = (name) => (block.match(new RegExp('--' + name + ':\\s*([^;]+);')) || [])[1];
      return varOf('bg-primary').trim() !== colors[0] ||
             varOf('bg-tertiary').trim() !== colors[1] ||
             varOf('accent-primary').trim() !== colors[2];
    });
    expect(mismatched.map(([id]) => id)).toEqual([]);
  });
});
