/**
 * mount-simge.test.js — TAKOZ MODÜLÜNÜN BİLEŞEN SİMGELERİ (kullanıcı 2026-11-11)
 * ─────────────────────────────────────────────────────────────────────────
 * Çözücü (Canlı Not 147) · Takoz (149) · Braket (150).
 *
 * ÇÖZÜCÜ'NÜN SİMGESİ (Canlı Not 147)
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

describe('TAKOZ SİMGESİ (Canlı Not 149)', () => {
  // "Bir sürü takoz teknik resmimiz var artık, oralardan bir yerlerden referans alarak güzel
  // bir resim koyalım." Önce: üst plaka + iki zikzak yay + zemin taraması.
  const s = simge('mnt-mount');
  test('konik takozun kesiti: iki kauçuk yarısı yeşil, metal gri, eksen çizgisi; yay ve tarama yok', () => {
    expect(s).not.toMatch(/Q32 33 44 38/);                                   // yay yok
    expect((s.match(/<line/g) || []).length).toBe(1);                        // tarama çizgisi yok, yalnız eksen
    expect(s).toMatch(/<line x1="50" y1="3" x2="50" y2="97"[^>]*stroke-dasharray/);
    expect((s.match(/fill="var\(--accent-success/g) || []).length).toBe(2); // kauçuk: iki yarı
    expect(s).toMatch(/H24 L32\.5 85 H67\.5 L76 44/);                        // dış manşon + flanş
  });
  test('palet kopyası aynı kesit, tek renk', () => {
    const p = palet('mnt-mount');
    expect(p).toMatch(/H24 L32\.5 85 H67\.5 L76 44/);
    expect(p).not.toMatch(/var\(--/);
  });
});

describe('BRAKET SİMGESİ (Canlı Not 150)', () => {
  const s = simge('mnt-bracket');
  test('köşebent + kaburga + dört delik; delik kutunun zemininde (sabit beyaz değil)', () => {
    expect(s).toMatch(/M18 12 H36 V70 H88 V88 H18 Z/);
    expect(s).toMatch(/M36 30 L36 70 L74 70 Z/);                             // kaburga
    expect((s.match(/<circle[^>]*fill="var\(--bg-tertiary/g) || []).length).toBe(4);
    expect(s).not.toMatch(/#fff"/);
  });
  test('palet kopyası aynı köşebent, tek renk', () => {
    const p = palet('mnt-bracket');
    expect(p).toMatch(/M36 30 L36 70 L74 70 Z/);
    expect(p).not.toMatch(/var\(--/);
  });
});
