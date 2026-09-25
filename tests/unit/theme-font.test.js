/**
 * theme-font.test.js — TUVALİN YAZI BOYU DA ÖLÇEKTEN
 * ────────────────────────────────────────────────────
 * Arayüzün ölçeği 2026-09-25'te bir basamak büyüdü (9/10/11/12/13 → 10/11/12/
 * 13/14 px) ama grafikler boyu SAYIYLA yazıyordu ve hiçbiri kıpırdamadı.
 * Ölçüldü (gerçek Chromium, 1920×1080): FEAD Sonuçlar grafiklerinde çizilen
 * 552 yazının 552'si 11 px'in altında; Motor ve Tork Konvertörü pencerelerinin
 * grafiklerinde 7–9 px. Tuval `var()` çözemediği için boy da köprüden geçer:
 * `veThemeFont('tiny')` → CSS'teki `--fs-tiny`.
 *
 * Üç kapı:
 *   1) Tuvale boy SAYIYLA verilmez — basamak adıyla verilir. Tek istisna
 *      Takoz 3B görüntüleyicisinin etiket DOKUSU (boy bir arayüz yazısı değil,
 *      sahnede ölçeklenen bir resmin çözünürlüğü).
 *   2) Köprünün yedek boyları CSS'le aynı (jsdom CSS yüklemez; yedek ayrışırsa
 *      testler bir ölçeği, program başkasını çizer).
 *   3) Kök yazı boyu 16 değilse (tarayıcı ayarı) tuval de arayüzle birlikte
 *      büyür — jeton rem cinsinden.
 */
const fs = require('fs');
const path = require('path');
const T = require('../../js/theme.js');

const ROOT = path.join(__dirname, '../..');
const JS_DIR = path.join(ROOT, 'js');
const CSS = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');

// CSS ölçeği — :root'taki --fs-* jetonları (rem → px, kök 16).
const OLCEK = {};
for (const m of CSS.matchAll(/--fs-([a-z0-9]+):\s*([\d.]+)rem/g)) OLCEK[m[1]] = parseFloat(m[2]) * 16;

// Tuvale boy veren çağrılar: `veThemeFont(<ilk argüman>`.
const CAGRILAR = [];
fs.readdirSync(JS_DIR).filter((f) => f.endsWith('.js') && f !== 'theme.js').forEach((f) => {
  fs.readFileSync(path.join(JS_DIR, f), 'utf8').split('\n').forEach((sat, i) => {
    for (const m of sat.matchAll(/veThemeFont\(\s*([^,)]+)/g)) CAGRILAR.push({ yer: f + ':' + (i + 1), arg: m[1].trim() });
  });
});
// 3B etiket DOKUSU — sahnede ölçeklenen resim, arayüz yazısı değil.
const DOKU = /^js\/cp-mount-viewer\.js$/;

describe('tuvale boy basamak ADIYLA verilir', () => {
  test('sayıyla boy yok (istisna yalnız 3B etiket dokusu)', () => {
    const sayili = CAGRILAR.filter((c) => !/^'[a-z]+'$/.test(c.arg))
      .filter((c) => !DOKU.test('js/' + c.yer.split(':')[0]));
    expect(sayili.map((c) => c.yer + ' → ' + c.arg)).toEqual([]);
  });

  test('verilen her basamak adı CSS ölçeğinde var', () => {
    const adlar = [...new Set(CAGRILAR.map((c) => (/^'([a-z]+)'$/.exec(c.arg) || [])[1]).filter(Boolean))];
    expect(adlar.filter((a) => !(a in OLCEK))).toEqual([]);
    // BOŞA ÇALIŞMIYOR: tarama gerçekten grafik çizen kodu buldu.
    expect(CAGRILAR.length).toBeGreaterThanOrEqual(90);
  });

  test('tuvaldeki en küçük yazı arayüzün en küçük basamağı (10 px)', () => {
    const boylar = CAGRILAR.map((c) => (/^'([a-z]+)'$/.exec(c.arg) || [])[1]).filter(Boolean).map((a) => OLCEK[a]);
    expect(Math.min(...boylar)).toBe(OLCEK.micro);
    expect(OLCEK.micro).toBeGreaterThanOrEqual(10);
  });
});

describe('köprü — veThemeFs / veThemeFont', () => {
  afterEach(() => { document.documentElement.removeAttribute('style'); });

  test('yedek boylar CSS ölçeğiyle aynı (jsdom CSS yüklemez)', () => {
    ['micro', 'tiny', 'body', 'md', 'lg', 'title'].forEach((ad) => {
      expect(ad + ': ' + T.veThemeFs(ad)).toBe(ad + ': ' + OLCEK[ad]);
    });
  });

  test('jeton okunabildiğinde CSS\'ten okunur — rem kökün yazı boyuyla çarpılır', () => {
    document.documentElement.style.setProperty('--fs-tiny', '0.6875rem');
    document.documentElement.style.fontSize = '20px';
    expect(T.veThemeFs('tiny')).toBeCloseTo(13.75, 9);
    document.documentElement.style.setProperty('--fs-tiny', '15px');
    expect(T.veThemeFs('tiny')).toBe(15);
  });

  test('veThemeFont basamak adını da sayıyı da kabul eder', () => {
    expect(T.veThemeFont('micro', 600)).toMatch(/^600 10px /);
    expect(T.veThemeFont(40, 'bold')).toMatch(/^bold 40px /);
    expect(T.veThemeFont('tiny')).toMatch(/^11px /);
  });
});

describe('tuvale CSS fonksiyonu verilmez — renk de köprüden geçer', () => {
  // Tuval `var(--…)` ve `color-mix(…)` ÇÖZEMEZ ve hata da vermez: geçersiz
  // değer sessizce yok sayılır, bir ÖNCEKİ renk kullanılır. Ölçüldü: Yol
  // bileşeninin segment profilinde iniş segmentleri `color-mix(in srgb,
  // var(--accent-success) 8%, transparent)` alıyordu ve %60 gri segment adı
  // rengiyle boyanıyordu. Doğrusu `veThemeRgba('--accent-success', 0.08)`.
  const CSS_FN = /(?:color-mix\(|var\(--)/;
  const bul = [];
  fs.readdirSync(JS_DIR).filter((f) => f.endsWith('.js')).forEach((f) => {
    const sat = fs.readFileSync(path.join(JS_DIR, f), 'utf8').split('\n');
    sat.forEach((s, i) => {
      // (1) doğrudan: ctx.fillStyle = '…var(--…'
      if (/\.(?:fillStyle|strokeStyle|shadowColor)\s*=\s*['"`][^'"`]*(?:color-mix\(|var\(--)/.test(s)) bul.push(f + ':' + (i + 1));
      // (2) değişkenle: var renk = '…color-mix(…'; … ctx.fillStyle = renk;
      const m = /\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*[^;]*['"`]([^'"`]*)/.exec(s);
      if (!m || !CSS_FN.test(s.slice(m.index))) return;
      for (let j = i + 1; j < Math.min(sat.length, i + 80); j++) {
        if (new RegExp('\\b(?:var|let|const)\\s+' + m[1] + '\\b').test(sat[j])) break;
        if (new RegExp('\\.(?:fillStyle|strokeStyle|shadowColor)\\s*=\\s*' + m[1] + '\\b').test(sat[j])) bul.push(f + ':' + (j + 1) + ' ← ' + m[1]);
      }
    });
  });

  test('fillStyle / strokeStyle / shadowColor CSS fonksiyonu taşımıyor', () => {
    expect(bul).toEqual([]);
  });
});
