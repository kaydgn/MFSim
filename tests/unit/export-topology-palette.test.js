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
// çifti, jetonların 0'ı tanımsız — ve 10'unun 10'u da varsayılan temanın
// değerinden SAPIYOR:
//
//     --text-muted       #888 · #aaa   vs  #646d7d
//     --text-secondary   #666 · #888 · #999  vs  #4e535e
//     --accent-primary   #3b82f6       vs  #2d6fe6
//     --accent-success   #22c55e       vs  #1a9a50
//     --accent-warning   #f59e0b · #ff9800   vs  #d49318
//     --accent-danger    #ef4444       vs  #d43d3d
//
// Sessizlik mekaniği: ekran doğru renkte görünür, indirilen dosya 2024
// paletinde çıkar. Hiçbir test bakmaz, hiçbir şey patlamaz — kullanıcı ancak
// bir SVG açtığında görür. Bu kapı o sapmayı GÖRÜNÜR ve ÖLÇÜLÜ tutar.
//
// SAPMA_TAVANI bir hedef değil BORÇTUR: yalnız aşağı iner. Atölye geçişinin
// "dışa çıkan belgeler" turunda 0'a indirilip bu sayı kaldırılacak.

const fs = require('fs');
const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '../../', f), 'utf8');

const comp = read('js/components.js');
const css = read('css/styles.css');
const themeJs = read('js/theme.js');

// Varsayılan tema — js/theme.js'teki ilk düşüş noktasından okunur, çivilenmez.
const VARSAYILAN = (themeJs.match(/var savedTheme = '([a-z]+)';/) || [])[1];

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

const SAPMA_TAVANI = 10;

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

  // BORÇ KAPISI — yalnız aşağı iner.
  test(`yedek ↔ varsayılan tema sapması ${SAPMA_TAVANI}'u geçmiyor`, () => {
    const t = jetonlar(temaBlogu(VARSAYILAN));
    const sapan = benzersiz
      .filter((c) => t[c.jeton] && t[c.jeton].toLowerCase() !== c.yedek.toLowerCase())
      .map((c) => `--${c.jeton}: ${c.yedek} ≠ ${t[c.jeton]}`);
    expect(sapan.length).toBeLessThanOrEqual(SAPMA_TAVANI);
  });
});
