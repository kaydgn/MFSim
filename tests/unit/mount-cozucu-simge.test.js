/**
 * mount-cozucu-simge.test.js — ÇÖZÜCÜ'NÜN SİMGESİ (kullanıcı 2026-11-11, Canlı Not 147)
 * ─────────────────────────────────────────────────────────────────────────
 * "Ayrıca sembolünü de değiştirelim. Sanki YouTube sembolü gibi olmuş."
 * Önce üç modülün Çözücü'sü (Takoz · Araç Performans · FEAD) kare çerçevede
 * oynatma üçgeniydi. Şimdi hesap makinesi: gövde, ekran, tuşlar; üç modülde aynı
 * çizim, renk modülün. Palet kopyası (index.html) aynı motifin tek renklisi.
 */
const fs = require('fs');
const path = require('path');
const kok = path.join(__dirname, '../..');
const src = fs.readFileSync(path.join(kok, 'js/components.js'), 'utf8');
const html = fs.readFileSync(path.join(kok, 'index.html'), 'utf8');

const simge = (tip) => {
  const i = src.indexOf("'" + tip + "': {");
  const j = src.indexOf("svg: '", i);
  return src.slice(j + 6, src.indexOf("',\n", j));
};
const palet = (tip) => {
  const i = html.indexOf('data-type="' + tip + '"');
  return html.slice(i, html.indexOf('</svg>', i));
};
const cizim = (svg) => svg.replace(/var\(--[a-z-]+, #[0-9a-f]+\)/g, 'R').replace(/width="\d+" height="\d+" viewBox/, 'viewBox');

describe('ÇÖZÜCÜ SİMGESİ (Canlı Not 147)', () => {
  const tipler = ['mnt-solver', 'solver', 'fead-solver'];

  test('oynatma üçgeni yok; gövde + ekran + sekiz tuş', () => {
    tipler.forEach((t) => {
      const s = simge(t);
      expect(s).not.toMatch(/<polygon/);
      expect((s.match(/<rect/g) || []).length).toBe(2 + 9);   // gövde · ekran · 9 tuş
    });
  });

  test('üç modülde aynı çizim, yalnız renk modülün', () => {
    const [a, b, c] = tipler.map((t) => cizim(simge(t)));
    expect(b).toBe(a);
    expect(c).toBe(a);
    expect(simge('mnt-solver')).toContain('--accent-danger');
    expect(simge('solver')).toContain('--accent-primary');
    expect(simge('fead-solver')).toContain('--accent-warning');
  });

  test('palet kopyası aynı motif, tek renk', () => {
    ['mnt-solver', 'solver'].forEach((t) => {
      const p = palet(t);
      expect(p).not.toMatch(/<polygon/);
      expect(p).toMatch(/<rect x="20" y="9" width="60" height="82"/);
      expect(p).not.toMatch(/var\(--/);
    });
  });
});
