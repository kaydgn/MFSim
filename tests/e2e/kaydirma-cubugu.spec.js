/**
 * kaydirma-cubugu.spec.js — EDGE'DE ÇİZİLEN KAYDIRMA ÇUBUĞU CSS'İN İSTEDİĞİ Mİ?
 * ───────────────────────────────────────────────────────────────────────────
 * css/styles.css 8 px, yuvarlak, zeminden ayrılan bir başparmak istiyordu
 * (::-webkit-scrollbar). Aynı dosyada Firefox için yazılmış
 * `scrollbar-width: thin` + `scrollbar-color` Chromium 121'den beri Edge'de
 * de geçerli ve ::-webkit-scrollbar'ı KAPATIYOR: ekrana tarayıcının 10 px'lik
 * standart çubuğu ok düğmeleriyle geliyordu (ölçüldü, Chromium 141).
 * Kullanıcı kararı 12·B (2026-09-26): CSS'in niyeti.
 *
 * Node'da koşamaz: jsdom yerleşim hesaplamaz. Playwright varsayılan olarak
 * `--hide-scrollbars` ile açıyor (çubuk 0 px) — bu halka o bayrağı kapatır.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BUILD = path.join(__dirname, '../..', 'MFSim_Code.html');
test.beforeAll(() => {
  if (!fs.existsSync(BUILD)) throw new Error('MFSim_Code.html yok. Önce: npm run build');
});
test.use({
  launchOptions: {
    ignoreDefaultArgs: ['--hide-scrollbars'],
    ...(process.env.MFSIM_CHROMIUM ? { executablePath: process.env.MFSIM_CHROMIUM } : {}),
  },
});
test.setTimeout(120000);

test('kaydırma çubuğu 8 px ve Chromium standart özelliğe DÜŞMÜYOR', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('file://' + BUILD);
  await page.fill('#mfsim-login-password', 'mfsim2024');
  await page.press('#mfsim-login-password', 'Enter');
  await page.waitForFunction(() => Array.isArray(window.nodes), null, { timeout: 90000 });
  await page.waitForSelector('#mfsim-loading-screen', { state: 'hidden', timeout: 90000 });
  await page.click('.ve-module-card[data-module="arac-performans"]');
  await page.waitForTimeout(1500);

  const r = await page.evaluate(() => {
    // Sentetik kutu: programın CSS'inden başka hiçbir şey taşımıyor.
    const k = document.createElement('div');
    k.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:120px;overflow:auto;z-index:99999';
    k.innerHTML = '<div style="height:600px;width:600px"></div>';
    document.body.appendChild(k);
    const c = getComputedStyle(k);
    const sentetik = { dikey: k.offsetWidth - k.clientWidth, yatay: k.offsetHeight - k.clientHeight, sw: c.scrollbarWidth, sc: c.scrollbarColor };
    k.remove();
    return { sentetik };
  });
  // Gerçek yüzey: komut paletinin listesi. Kendi `scrollbar-width:thin`
  // satırı vardı (kaldırıldı); o satır bu listede çubuğu standart çizime
  // düşürüyordu.
  await page.keyboard.press('Control+k');
  await page.waitForSelector('.ve-cmdk-list', { state: 'visible', timeout: 10000 });
  const g = await page.evaluate(() => {
    const yan = document.querySelector('.ve-cmdk-list');
    const c = getComputedStyle(yan);
    return { kayiyor: yan.scrollHeight > yan.clientHeight + 1, kalinlik: yan.offsetWidth - yan.clientWidth - (parseFloat(c.borderLeftWidth) || 0) - (parseFloat(c.borderRightWidth) || 0), sw: c.scrollbarWidth };
  });
  r.gercek = g;
  // Standart özellik Chromium'da `auto` kalmalı — değilse ::-webkit-scrollbar kapanır.
  expect(r.sentetik.sw).toBe('auto');
  expect(r.sentetik.sc).toBe('auto');
  expect(r.sentetik.dikey).toBe(8);
  expect(r.sentetik.yatay).toBe(8);
  expect(r.gercek.kayiyor).toBe(true);
  expect(r.gercek.sw).toBe('auto');
  expect(r.gercek.kalinlik).toBe(8);
});
