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

describe('tema kimlikleri üç kaynakta senkron', () => {
  test('en az bir tema bulundu (regex kayması erken yakalansın)', () => {
    expect(validIds.length).toBeGreaterThan(0);
    expect(settingsIds.length).toBeGreaterThan(0);
  });

  test('theme.js `valid` == settings.js menüsü', () => {
    expect(validIds).toEqual(settingsIds);
  });

  test('her tema kimliğinin styles.css bloğu ve --bg-primary tanımı var', () => {
    const missing = validIds.filter((id) => {
      const m = css.match(new RegExp('\\[data-theme="' + id + '"\\][^{]*\\{([^}]*)\\}'));
      return !m || !/--bg-primary\s*:/.test(m[1]);
    });
    expect(missing).toEqual([]);
  });

  test('Donanma Mavisi (navy) her üç kaynakta mevcut', () => {
    expect(validIds).toContain('navy');
    expect(settingsIds).toContain('navy');
    expect(css).toContain('[data-theme="navy"]');
  });
});
