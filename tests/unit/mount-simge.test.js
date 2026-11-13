/**
 * mount-simge.test.js — TAKOZ MODÜLÜNÜN BİLEŞEN SİMGELERİ (kullanıcı 2026-11-11)
 * ─────────────────────────────────────────────────────────────────────────
 * Çözücü (Canlı Not 147) · Takoz (157; 149'un kesitinin yerine) · Braket (150).
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

describe('TAKOZ SİMGESİ (Canlı Not 157)', () => {
  // "Takoz resimlerini beğenmedim. Çok teknik olmuş. Böyle daha tatlı, daha şekilsel olabilir."
  // Önce (149): konik takozun kesiti — iç koni, iki kauçuk yarısı, manşon, kesik-noktalı eksen;
  // 38 px'te kova gibi okunuyordu. Şimdi yandan tombul takoz, kalın dolu biçimler.
  const s = simge('mnt-mount');
  const kaucuk = s.match(/<g fill="var\(--accent-success, #1a7f37\)"[^>]*>(.*?)<\/g>/);
  const rulolar = kaucuk ? [...kaucuk[1].matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]) : [];

  test('kesit değil: eksen, tarama ve ince çizgi yok', () => {
    expect(s).not.toMatch(/stroke-dasharray/);                               // eksen çizgisi yok
    expect(s).not.toMatch(/<line/);                                          // eksen ve tarama yok
    expect(s).not.toMatch(/H24 L32\.5 85/);                                  // manşon + flanş kesiti yok
    const kalinlik = [...s.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(kalinlik.filter((k) => k < 4)).toEqual([]);
  });

  test('kauçuk iki dolu yeşil rulo; saplamalı kapak ve delikli flanş metal', () => {
    expect(rulolar).toHaveLength(2);                                         // iki yuvarlak uçlu rulo
    rulolar.forEach((d) => expect(d).toMatch(/ A[\d.]+ [\d.]+ 0 0 1 /));
    expect((s.match(/<rect[^>]*fill="var\(--text-secondary/g) || []).length).toBe(3); // saplama · kapak · flanş
    expect((s.match(/<circle[^>]*fill="var\(--bg-tertiary/g) || []).length).toBe(2);  // flanşın iki deliği
  });

  test('palet kopyası aynı rulolar, tek renk', () => {
    const p = palet('mnt-mount');
    expect(rulolar).toHaveLength(2);                                         // boşuna geçmesin
    rulolar.forEach((d) => expect(p).toContain('d="' + d + '"'));
    expect(p).not.toMatch(/var\(--|stroke-dasharray|<line/);
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
