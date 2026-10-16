/**
 * kontrast.spec.js — EKRANDAKİ YAZI ZEMİNİNE KARŞI OKUNUR MU? (WCAG 2.1 AA)
 * ───────────────────────────────────────────────────────────────────────
 *
 * `theme-contrast.test.js` PALETİ sınar. Ekrandaki yazı ise rengini başka
 * yollardan da alıyordu ve palet testi onları göremez:
 *   · sabit renk     çözücü günlüğü #c88a20 · #2e9e44 (2,27 · 2,65:1); motor
 *                    ızgarası, konvertör lejantı #5b95fb · #e0725f · #4aa3ff ·
 *                    #ff6b6b (2,26–2,94:1) — lejant çizginin rengini de
 *                    TUTMUYORDU (çizgi --seri-1, lejant #4aa3ff)
 *   · ham vurgu      --accent-* METİN olarak (3,73–4,38:1)
 *   · opaklık        jetonla yazılıp `opacity:.5–.85` ile soldurulan yazı
 *                    (2,13–4,36:1) — renk doğru, ekrandaki sonuç değil
 * Ölçüt tests/helpers/kontrast-olcu.js'te (CAN Çözümleyici ve Ölçüm
 * Görüntüleyici aynısını kullanıyor). Gezilen yüzeyler yerleşim kapısıyla
 * AYNI tur (tests/e2e/helpers/yuzey-turu.js): hangi pencerenin hangi veriyle
 * açılacağı orada, burada yalnız ne ölçüleceği. Node'da koşamaz: jsdom
 * kaskadı, opaklığı ve yerleşimi hesaplamaz.
 */
const { test, expect } = require('@playwright/test');
const { kontrastKur, kontrastOzet } = require('../helpers/kontrast-olcu.js');
const T = require('./helpers/yuzey-turu');

test.describe.configure({ timeout: 240000 });
// GitHub API'si fikstürden (helpers/github-fikstur.js): servis çalışanının çektiği
// istek route'a uğramaz.
test.use({ serviceWorkers: 'block' });

// Bir kökü ölç; kapalı <details>'ları önce aç (içindeki tablo da yazıdır).
function olcucu(page, kotu) {
  return async (kok, yer) => {
    const r = await page.evaluate((k) => {
      const el = document.querySelector(k);
      if (el) el.querySelectorAll('details:not([open])').forEach((d) => { d.open = true; });
      return window.__kontrast(k);
    }, kok);
    r.kotu.forEach((x) => kotu.push(Object.assign({ yer }, x)));
    return r;
  };
}

const TURLAR = [
  ['kabuk: karşılama, Program Arşivi, Program Durumu, komut paleti, Ayarlar', 'arac-performans', T.kabukTuru, true],
  ['Araç Performans: bütün pencereler, çözücü günlüğü, rapor penceresi, Sonuçlar', 'arac-performans', T.apTuru],
  ['Takoz: bütün pencereler, çözüm sonrası, Sonuçlar', 'mount-analysis', T.takozTuru],
  ['FEAD: pencereler, kanvas, araçlar, sihirbaz, Sonuçlar ve özet', 'arac-performans', T.feadTuru],
];

// İki tema: koyu temada --on-* (vurgu üstünde yazı) koyudur — sabit beyaz
// yazı orada 3,18:1 kalıyordu; açık temada ise ham vurgu ve soluk jeton.
for (const tema of ['acik', 'koyu']) {
  for (const [ad, modul, tur, karsilama] of TURLAR) {
    test(`${ad} AA · ${tema}`, async ({ page }) => {
      const kotu = [];
      const olc = olcucu(page, kotu);
      await T.bootApp(page, { modul, tema, kur: kontrastKur,
        karsilama: karsilama ? () => olc('#ve-module-overlay', 'karşılama') : null });
      await tur(page, olc);
      expect(kontrastOzet(kotu)).toEqual([]);
    });
  }
}
