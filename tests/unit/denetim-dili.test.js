/**
 * Denetim dili — css/styles.css › kaydırma çubuğu, açılır liste, sayı alanı
 * ─────────────────────────────────────────────────────────────────────────
 * Kullanıcı kararları (2026-09-26):
 *  12·B  kaydırma çubuğu CSS'in niyeti: 8 px, yuvarlak, oksuz. Standart
 *        `scrollbar-width/-color` Chromium 121'den beri ::-webkit-scrollbar'ı
 *        kapatıyordu; yalnız Firefox'a ayrıldı.
 *  11·B  açılır liste tek görünüşte (programın oku), sayı alanı oksuz.
 * Gerçek çizim tarayıcıda ölçülür: tests/e2e/kaydirma-cubugu.spec.js ve
 * mufettis-sigma.spec.js → "yerel liste" / "sayı alanı oklu". Bu dosya
 * kuralların kendisini tutar (hızlı geri bildirim).
 */
const fs = require('fs');
const path = require('path');
const css = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8');

// @supports not selector(::-webkit-scrollbar) { … } bloğunu çıkar (iç içe süslü parantezle)
function firefoxBlogunuAt(s) {
  const bas = s.indexOf('@supports not selector(::-webkit-scrollbar)');
  if (bas < 0) return { kalan: s, blok: '' };
  let i = s.indexOf('{', bas), d = 0, j = i;
  for (; j < s.length; j++) { if (s[j] === '{') d++; else if (s[j] === '}') { d--; if (d === 0) break; } }
  return { kalan: s.slice(0, bas) + s.slice(j + 1), blok: s.slice(bas, j + 1) };
}

describe('12·B kaydırma çubuğu', () => {
  const { kalan, blok } = firefoxBlogunuAt(css.replace(/\/\*[\s\S]*?\*\//g, ''));

  test('standart özellikler YALNIZ ::-webkit-scrollbar\'ı tanımayan tarayıcıda', () => {
    expect(blok).toMatch(/scrollbar-width:\s*thin/);
    expect(kalan).not.toMatch(/scrollbar-color\s*:/);
    // `none` (çubuğu gizlemek) iki motorda da aynı çalışır — o serbest
    const yazilan = [...kalan.matchAll(/scrollbar-width\s*:\s*([a-z]+)/g)].map((m) => m[1]);
    expect(yazilan.filter((v) => v !== 'none')).toEqual([]);
  });

  test('::-webkit-scrollbar 8 px ve başparmak yuvarlak', () => {
    expect(css).toMatch(/::-webkit-scrollbar\s*\{\s*width:\s*8px;\s*height:\s*8px;/);
    expect(css).toMatch(/::-webkit-scrollbar-thumb\s*\{[^}]*border-radius:\s*var\(--radius-pill\)/);
  });
});

describe('11·B açılır liste ve sayı alanı', () => {
  const kural = (css.match(/\n\s*select:not\(\[multiple\]\):not\(\[size\]\)\s*\{([^}]*)\}/) || [])[1] || '';

  test('her liste programın okuyla — satır içi `background:` kısaltmasına rağmen', () => {
    expect(kural).toMatch(/appearance:\s*none/);
    expect(kural).toMatch(/background-image:[^;]*currentColor[^;]*!important/);
    expect(kural).toMatch(/background-repeat:\s*no-repeat\s*!important/);
    expect(kural).toMatch(/padding-right:\s*15px\s*!important/);
  });

  test('sayı alanı tarayıcının oklarını açmıyor', () => {
    expect(css).toMatch(/input\[type=number\]\s*\{[^}]*appearance:\s*textfield/);
    expect(css).toMatch(/::-webkit-inner-spin-button[\s\S]{0,120}-webkit-appearance:\s*none/);
  });
});
