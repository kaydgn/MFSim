/**
 * SON DEĞİŞİKLİKLERİN GÖRSELİ — tools/degisiklik-resim.js + build.js
 *
 * Kullanıcı 2026-11-05 (Canlı Not 27): "Her son değişikliği görselli olarak görmek
 * istiyorum" → "Olur uygula. Elinde olan görüntüleri eklersin." Görsel nota bağlı
 * (assets/degisiklik/not-N.webp, Canlı Not'un sonuç görüntüsü, 2×); derleme YALNIZ
 * künyenin modül listesindeki commit'lerin notlarını gömer — boyut listeyle sınırlı.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const R = require('../../tools/degisiklik-resim.js');
const { webpOlcu } = require('../../tools/karsilama-webp.js');

// En küçük geçerli VP8X başlığı: genişlik/yükseklik − 1, 24 bit
function sahteWebp(g, y) {
  const b = Buffer.alloc(30);
  b.write('RIFF', 0); b.writeUInt32LE(22, 4); b.write('WEBP', 8); b.write('VP8X', 12); b.writeUInt32LE(10, 16);
  b.writeUIntLE(g - 1, 24, 3); b.writeUIntLE(y - 1, 27, 3);
  return b;
}

describe('SON DEĞİŞİKLİKLERİN GÖRSELİ', () => {
  test('gömülecekler: yalnız künyedeki notlar; gösterim ölçüsü pikselin yarısı; dosyasız not atlanır', () => {
    const k = fs.mkdtempSync(path.join(os.tmpdir(), 'mfsim-deg-'));
    try {
      fs.writeFileSync(path.join(k, 'not-22.webp'), sahteWebp(1120, 700));
      fs.writeFileSync(path.join(k, 'not-5.webp'), sahteWebp(400, 300));       // listede yok → gömülmez
      const info = { moduller: { takoz: [{ ayrinti: [{ notlar: [22] }, { notlar: [9, 22] }] }] } };
      const g = R.gomulecekler(info, k);
      expect(Object.keys(g)).toEqual(['22']);
      expect([g[22].g, g[22].y]).toEqual([560, 350]);
      expect(g[22].src.startsWith('data:image/webp;base64,')).toBe(true);
      expect(R.gomulecekler({}, k)).toEqual({});
    } finally { fs.rmSync(k, { recursive: true, force: true }); }
  });

  test('klasör: yalnız not-N.webp, her biri geçerli webp, en çok 1120 px geniş ve tavanın altında', () => {
    const adlar = fs.readdirSync(R.KLASOR);
    expect(adlar.length).toBeGreaterThanOrEqual(20);                           // Not 6 · 8–26
    adlar.forEach((a) => {
      expect(a).toMatch(/^not-\d+\.webp$/);
      const buf = fs.readFileSync(path.join(R.KLASOR, a)), o = webpOlcu(buf);
      expect(o).not.toBeNull();
      expect(o[0]).toBeLessThanOrEqual(R.EN_GENIS);
      expect(buf.length).toBeLessThanOrEqual(R.RESIM_TAVAN);
    });
  });

  test('derleme gömer: tek betik bloğunda __MFSIM_DEGISIKLIK, künyeden', () => {
    const b = fs.readFileSync(path.join(__dirname, '../../build.js'), 'utf8');
    expect(b).toMatch(/require\('\.\/tools\/degisiklik-resim\.js'\)\.gomulecekler\(VERSION_INFO\)/);
    expect(b).toMatch(/'window\.__MFSIM_DEGISIKLIK = ' \+ JSON\.stringify\(DEGISIKLIK\)/);
  });
});
