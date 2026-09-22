/**
 * marka-tutarli.spec.js — MARKA AÇILIŞTAN KARŞILAMAYA AYNI ÇİZİLİYOR MU?
 * ────────────────────────────────────────────────────────────────────────
 *
 * ÖLÇÜLEN KUSUR (2026-09-22): "MFSim" yazısı açılış ekranında -0,2px,
 * karşılama ekranında +0,5px tracking ile çiziliyordu — aynı yüz (Source
 * Serif 4), aynı boy (20px), saniyeler arayla. Devir teslimde marka
 * görünür biçimde geniyordu.
 *
 * Sebep bir renk tercihi değil KASKAD: display yüzü bağlaması
 * (`h1..h4, .mfsim-loading-logo, .ve-welcome-logo { letter-spacing:-0.01em }`)
 * ile üç elemanın kendi `letter-spacing:0.5px` bildirimi AYNI özgüllükte.
 * İkisinde bağlama SONRA geldiği için kazanıyordu (bildirim ölüydü),
 * `.ve-welcome-logo` ise bağlamadan sonra tanımlı olduğu için KAZANIYORDU.
 * `0.5px` eski SANS marka yazısından kalmaydı.
 *
 * Bu halka Node'da koşamaz: jsdom kaskadı çözmez, `letterSpacing`i
 * hesaplamaz ve metin genişliği ölçmez.
 *
 * Kardeş kural: açılış kartı ile karşılama kartının geometrisi zaten 1 px'e
 * kadar kilitli (`loader-splash.test.js`) — gerekçesi aynı: devir teslimde
 * hiçbir şey yerinden oynamamalı. Marka o kartın İÇİNDEKİ yazı.
 */
const { test, expect } = require('@playwright/test');

test('marka açılışta ve karşılamada AYNI tracking ile çiziliyor', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/index.html');

  // Açılış ekranı DURURKEN ölç — yükleyici başlamadan.
  const acilis = await page.evaluate(() => {
    const el = document.querySelector('.mfsim-loading-logo');
    const cs = getComputedStyle(el);
    return { ls: cs.letterSpacing, yuz: cs.fontFamily.split(',')[0].replace(/"/g, ''), boy: cs.fontSize };
  });

  await page.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || getComputedStyle(s).display === 'none';
  }, null, { timeout: 90000 });
  await page.waitForTimeout(500);

  const karsilama = await page.evaluate(() => {
    const el = document.querySelector('.ve-welcome-logo');
    const cs = getComputedStyle(el);
    return { ls: cs.letterSpacing, yuz: cs.fontFamily.split(',')[0].replace(/"/g, ''), boy: cs.fontSize };
  });

  expect(karsilama).toEqual(acilis);                 // ÜÇÜ DE birebir
  expect(acilis.yuz).toBe('Source Serif 4');         // display yüzü gerçekten yüklü
  expect(acilis.ls).toBe('-0.2px');                  // = -0.01em × 20px, bağlamadan
});

test('markanın GENİŞLİĞİ tracking farkını gösterecek kadar duyarlı', async ({ page }) => {
  // Kapının boşa çalışmadığının kanıtı: eski değeri geri koyunca yazı
  // GERÇEKTEN geniyor. Tracking eşitliği ölçmek tek başına, ölçülen şeyin
  // görünür bir fark olduğunu söylemez.
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || getComputedStyle(s).display === 'none';
  }, null, { timeout: 90000 });
  await page.waitForTimeout(500);

  const fark = await page.evaluate(() => {
    const yazi = document.querySelector('.ve-welcome-logo span:last-child');
    const simdi = yazi.getBoundingClientRect().width;
    yazi.parentElement.style.letterSpacing = '0.5px';   // ESKİ değer
    const eski = yazi.getBoundingClientRect().width;
    yazi.parentElement.style.letterSpacing = '';
    return { simdi: +simdi.toFixed(2), eski: +eski.toFixed(2), d: +(eski - simdi).toFixed(2) };
  });
  // 5 karakter × 0,7px = ~3,5px — %5'lik bir genleme, göz ayırır
  expect(fark.d).toBeGreaterThan(2.5);
});
