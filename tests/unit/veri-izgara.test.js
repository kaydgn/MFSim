/**
 * Veri ızgarası TABLO gibi — kullanıcı kararı 13·B (2026-09-26)
 * ─────────────────────────────────────────────────────────────
 * Hücrenin kutusu yalnız fare üstünde ve yazarken çıkar. Önce beş ızgarada
 * (motor · aksesuar · TK · şanzıman · transfer) 189 girdinin 189'u
 * dinlenmede çerçeveli ve zeminliydi; tablonun kendi çizgisiyle yan yana
 * çift çizgi okunuyordu. İki şey BİRLİKTE gerekir:
 *   1. CSS: `table.ve-izgara` girdisi dinlenmede şeffaf, fare üstünde ve
 *      odakta kutulu.
 *   2. İşaretleme: ızgara girdisi satır içi zemin/çerçeve TAŞIMAZ. Satır içi
 *      stil CSS'i yener ve durum ifade edemez — kutu dinlenmede kalır.
 * Gerçek çizim tarayıcıda: mufettis-sigma.spec.js → "ızgarada kutulu hücre".
 */
const fs = require('fs');
const path = require('path');

const stubs = stubGlobals();
eval(loadSource('cp-gearbox.js'));
eval(loadSource('cp-torque-converter.js'));
beforeEach(() => resetStubs(stubs));

const kok = path.join(__dirname, '../..');
const oku = (f) => fs.readFileSync(path.join(kok, f), 'utf8');
const css = oku('css/styles.css').replace(/\/\*[\s\S]*?\*\//g, '');

// Seçici listesi tam olarak `sec` olan kuralın gövdesi
function kural(sec) {
  const kurallar = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const bul = kurallar.find((m) => m[1].trim().replace(/\s+/g, ' ') === sec);
  return bul ? bul[2] : '';
}

function satir(html) {
  const tb = document.createElement('tbody');
  tb.innerHTML = html;
  return tb.querySelector('tr');
}

describe('ızgara satırı satır içi kutu yazmıyor', () => {
  test.each([
    ['TK', () => getVETCRowHTML('n1', 0.1, 96.96, 2.49)],
    ['şanzıman', () => getVEFTGearRowHTML('n1', '1C', 3.487, 98.93, false)],
  ])('%s — girdi zemin/çerçeve taşımıyor, silme düğmesi sade', (ad, uret) => {
    const tr = satir(uret());
    const girdiler = [...tr.querySelectorAll('input:not([type=hidden])')];
    expect(girdiler.length).toBeGreaterThanOrEqual(3);
    girdiler.forEach((g) => expect(g.getAttribute('style') || '').not.toMatch(/background|border/));
    // Satır başına kırmızı dolu "×" yerine motor ızgarasının sade düğmesi
    const sil = tr.querySelector('button');
    expect(sil.className).toBe('ve-row-del');
    expect(sil.getAttribute('style')).toBeNull();
  });

  test('satır içinde kurulan ızgaralar da (aksesuar · transfer · motor) — kaynağın kendisi', () => {
    // Bu üç ızgara büyük panel kurucularının İÇİNDE; kurucuları çağırmak
    // yerine ızgaranın kendi kaynak bloğu taranır.
    const blok = (dosya, bas) => {
      const s = oku(dosya); const i = s.indexOf(bas);
      expect(i).toBeGreaterThan(-1);
      return s.slice(i, s.indexOf("</tbody></table>", i));
    };
    const bloklar = [
      blok('js/cp-engine.js', `'<table class="ve-eng-acc ve-izgara">'`),
      blok('js/cp-drivetrain.js', `'<table class="ve-pnl-tbl ve-izgara">'`),
      oku('js/cp-engine.js').match(/function veEngSheetRowHTML[\s\S]*?\n}\n/)[0],
    ];
    bloklar.forEach((b) => {
      const girdiler = b.match(/<input\b[^>]*>/g) || [];
      expect(girdiler.length).toBeGreaterThan(0);
      girdiler.forEach((g) => expect(g).not.toMatch(/style="[^"]*(background|border)/));
      // Hücre de zemin boyamaz (eski aksesuar/transfer hücreleri bg-tertiary'di)
      expect(b).not.toMatch(/<td[^>]*style="[^"]*background/);
    });
  });

  test('beş ızgara sınıfı taşıyor — motor · aksesuar · TK · şanzıman · transfer', () => {
    const say = (f) => (oku(f).match(/<table class="[^"]*\bve-izgara\b/g) || []).length;
    expect({
      motor: say('js/cp-engine.js'), tk: say('js/cp-torque-converter.js'),
      sanziman: say('js/cp-gearbox.js'), transfer: say('js/cp-drivetrain.js'),
    }).toEqual({ motor: 2, tk: 1, sanziman: 1, transfer: 1 });
  });
});

describe('ızgaranın CSS kuralı', () => {
  const G = '.ve-properties-content table.ve-izgara td input';

  test('dinlenmede kutusuz', () => {
    const k = kural(`${G}[type="number"], ${G}[type="text"]`);
    expect(k).toMatch(/background:\s*transparent/);
    expect(k).toMatch(/border-color:\s*transparent/);
  });

  test('fare üstünde ve odakta kutulu — salt okunur hücre hariç', () => {
    expect(kural(`${G}:not([readonly]):hover`)).toMatch(/border-color:\s*var\(--border-color\)/);
    expect(kural(`${G}:not([readonly]):focus`)).toMatch(/border-color:\s*var\(--accent-primary\)/);
  });

  test('ızgarada dikey çizgi yok ve satır fare üstünde tonlanıyor', () => {
    expect(kural('.ve-properties-content table.ve-izgara th')).toMatch(/border-right:\s*0/);
    expect(kural('.ve-properties-content table.ve-izgara tbody tr:hover')).toMatch(/var\(--accent-tint-8\)/);
    // Motor ızgarasının kendi kuralı: hücre çizgisi yatay, zemin yok
    const td = kural('.ve-properties-content .ve-eng-sheet td');
    expect(td).toMatch(/border-right:\s*0/);
    expect(td).not.toMatch(/background/);
  });
});
