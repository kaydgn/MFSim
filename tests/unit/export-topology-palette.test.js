// ── DIŞA AKTARMANIN GİZLİ PALETİ ────────────────────────────────────────────
//
// js/export-topology.js kendi başlığında yazıyor (satır 9-10):
//
//     def.svg sembolleri var(--x, yedek) renk kullanır → bağımsız SVG'de
//     yedek renkler devreye girer, stil sayfası gerekmez.
//
// Yani indirilen SVG/PNG ekrandaki temayı DEĞİL, js/components.js'teki
// `var(--jeton, #yedek)` çiftlerinin YEDEK yarısını kullanıyor. Bu ikinci bir
// palettir ve bugüne kadar hiçbir kapısı yoktu.
//
// ÖLÇÜLDÜ (2026-09-22): 331 `var(--x, #y)` çağrısı, 10 benzersiz jeton|yedek
// çifti — ve 10'unun 10'u da varsayılan temanın değerinden SAPIYORDU:
//
//     --text-muted       #888 · #aaa          vs  #676055
//     --text-secondary   #666 · #888 · #999   vs  #544e44
//     --accent-primary   #3b82f6              vs  #a8502b
//     --accent-success   #22c55e              vs  #2f6b45
//     --accent-warning   #f59e0b · #ff9800    vs  #8a6a12
//     --accent-danger    #ef4444              vs  #9a3b3b
//
// Sessizlik mekaniği: ekran Atölye'de, indirilen dosya 2024 paletinde. Hiçbir
// test bakmaz, hiçbir şey patlamaz — kullanıcı ancak bir SVG açtığında görür.
//
// SAPMA ARTIK SIFIR ve kapı BİR BORÇ TAVANI DEĞİL, BİR EŞİTLİKTİR: her yedek
// varsayılan temanın değerinin AYNISI olmak zorunda. Tavanlı hâl, palet
// değişince sapmanın sessizce geri gelmesine on kişilik yer bırakıyordu.

const fs = require('fs');
const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '../../', f), 'utf8');

const comp = read('js/components.js');
const css = read('css/styles.css');

// BELGENİN VARSAYILAN PALETİ — `:root` ile virgüllü bildirilen kimlik. Burası
// çivilenmez: attribute'suz bir belgenin (ve bağımsız SVG'nin) gerçekten
// düştüğü blok hangisiyse ölçüt odur.
const VARSAYILAN = (css.match(/:root,\s*\[data-theme="([\w-]+)"\]\s*\{/) || [])[1];

function temaBlogu(id) {
  const re = new RegExp('\\[data-theme="' + id + '"\\][^{]*\\{([^}]*)\\}', 'g');
  for (const m of css.matchAll(re)) {
    if (/--bg-primary\s*:/.test(m[1])) return m[1];
  }
  return '';
}

function jetonlar(blok) {
  const out = {};
  let m;
  const re = /--([\w-]+):\s*([^;]+);/g;
  while ((m = re.exec(blok)) !== null) out[m[1]] = m[2].trim();
  return out;
}

// components.js içindeki her `var(--jeton, #yedek)` çifti
const ciftler = [...comp.matchAll(/var\(\s*--([\w-]+)\s*,\s*(#[0-9a-fA-F]{3,8})\s*\)/g)]
  .map((m) => ({ jeton: m[1], yedek: m[2] }));

const benzersiz = [...new Map(ciftler.map((c) => [c.jeton + '|' + c.yedek, c])).values()];


describe('dışa aktarmanın yedek paleti', () => {
  test('varsayılan tema okunabildi (regex kayması erken yakalansın)', () => {
    expect(VARSAYILAN).toBeTruthy();
    expect(Object.keys(jetonlar(temaBlogu(VARSAYILAN))).length).toBeGreaterThan(20);
  });

  test('components.js hâlâ yedekli var() kullanıyor', () => {
    // Bu sayı düşerse sembollerin renk kaynağı değişmiş demektir; o zaman
    // export-topology.js'in başlığındaki sözleşme de güncellenmeli.
    expect(ciftler.length).toBeGreaterThan(100);
    expect(benzersiz.length).toBeGreaterThan(0);
  });

  // Yedeksiz bir var() bağımsız SVG'de RENKSİZ çizer (stil sayfası yok).
  test('sembollerde yedeksiz var(--x) yok', () => {
    const svgler = [...comp.matchAll(/svg:\s*'([^']*)'/g)].map((m) => m[1]);
    const yedeksiz = [];
    svgler.forEach((s) => {
      [...s.matchAll(/var\(\s*--[\w-]+\s*\)/g)].forEach((m) => yedeksiz.push(m[0]));
    });
    expect(yedeksiz).toEqual([]);
  });

  test('her yedeğin jetonu varsayılan temada TANIMLI', () => {
    const t = jetonlar(temaBlogu(VARSAYILAN));
    const bilinmeyen = benzersiz.filter((c) => !t[c.jeton]).map((c) => '--' + c.jeton);
    expect([...new Set(bilinmeyen)]).toEqual([]);
  });

  // EŞİTLİK KAPISI — indirilen belge ekranla AYNI paleti taşır.
  test('her yedek varsayılan temanın değeriyle BİREBİR aynı', () => {
    const t = jetonlar(temaBlogu(VARSAYILAN));
    const sapan = benzersiz
      .filter((c) => t[c.jeton] && t[c.jeton].toLowerCase() !== c.yedek.toLowerCase())
      .map((c) => `--${c.jeton}: ${c.yedek} ≠ ${t[c.jeton]}`);
    expect(sapan).toEqual([]);
  });
});
