/**
 * fead-yerlesim.spec.js — ÖRNEK YÜKLENİNCE KARTLAR NEREYE DÜŞÜYOR
 *
 * Kullanıcı bildirimi (2026-09-14): *"FEAD bileşenini açıp, bir örnek
 * yüklediğimde, topolojiye kanvaslar bu şekilde geliyor… yan yana, güzel bir
 * şekilde gelsinler. Alt alta hiç estetik durmuyor."*
 *
 * İKİ YOL VAR ve ikisi de ölçülüyor:
 *
 *   1) OLAĞAN — `veFeadArrangeByCoords` koşuyor (kanvaslar yan yana,
 *      künyeler solda). Bu yol Node'da da ölçülebiliyor.
 *
 *   2) YEDEK — kurucunun kendi ilk karesi. Yerleştirici çağrısı `try/catch`
 *      ile sarılı, yani o yol bir kez patlarsa GEÇERLİ KALAN sıra budur ve
 *      eskiden kanvasları ALT ALTA diziyordu. Node'da ÖLÇÜLEMEZ: yerleştirici
 *      aynı modül kapsamında duruyor, stub'lanamıyor ve koordinatların üstüne
 *      hemen yazıyor. Tarayıcıda `window.veFeadArrangeByCoords` gerçek bir
 *      global, yani kırılabiliyor — bu halkanın tek koşabildiği yer burası.
 */
const { test, expect } = require('@playwright/test');
test.setTimeout(180000);

async function feadOrnek(page, kir) {
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' && typeof window.veFeadOpenEditor === 'function' &&
    Array.isArray(window.nodes), null, { timeout: 90000 });
  await page.evaluate(() => {
    if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans');
  });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none';
  }, null, { timeout: 90000 });
  await page.evaluate(() => { const n = createNode('fead-analysis', 400, 300); veFeadOpenEditor(n.id); });
  await page.waitForTimeout(400);
  await page.evaluate(() => { if (typeof veFeadWizClose === 'function') veFeadWizClose(false); });
  await page.waitForTimeout(250);
  if (kir) await page.evaluate(() => {
    window.veFeadArrangeByCoords = () => { throw new Error('yerleştirici kırıldı'); };
  });
  await page.evaluate(() => veFeadLoadExample('AG00976_GATES_2025'));
  await page.waitForTimeout(1400);
}

const olc = (page) => page.evaluate(() => {
  const gorunen = window.nodes.filter((n) => !veIsCanvasHidden(n)).map((n) => ({
    tip: n.type, ad: n.customName || (componentDefs[n.type] || {}).name,
    x: n.x, y: n.y,
    w: n.width || (componentDefs[n.type] || {}).defaultWidth,
    h: n.height || (componentDefs[n.type] || {}).defaultHeight,
  }));
  const kan = gorunen.filter((a) => a.tip === 'fead-layout').sort((a, b) => a.x - b.x);
  const sol = gorunen.filter((a) => a.tip !== 'fead-layout');
  const x0 = Math.min(...gorunen.map((a) => a.x)), x1 = Math.max(...gorunen.map((a) => a.x + a.w));
  const y0 = Math.min(...gorunen.map((a) => a.y)), y1 = Math.max(...gorunen.map((a) => a.y + a.h));
  // Kartlardan herhangi ikisi çakışıyor mu?
  let cakisma = 0;
  for (let i = 0; i < gorunen.length; i++)
    for (let j = i + 1; j < gorunen.length; j++) {
      const a = gorunen[i], b = gorunen[j];
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) cakisma++;
    }
  return {
    kanvas: kan, sol, cakisma,
    kutu: { w: Math.round(x1 - x0), h: Math.round(y1 - y0) },
  };
});

function kapilar(r) {
  // KANVASLAR YAN YANA: aynı satır, soldakinin sağ kenarından sonra başlıyor.
  expect(r.kanvas).toHaveLength(2);
  expect(r.kanvas[0].y).toBe(r.kanvas[1].y);
  expect(r.kanvas[1].x).toBeGreaterThanOrEqual(r.kanvas[0].x + r.kanvas[0].w);
  // KÜNYELER SOLDA — kanvas sırasının solunda, ona değmeden. (Tablo
  // 2026-09-23'te kanvastan indi — Çizim Masası; üst sırayı artık o tutmuyor.)
  expect(r.sol.length).toBeGreaterThan(0);
  r.sol.forEach((a) => expect(a.x + a.w).toBeLessThanOrEqual(r.kanvas[0].x));
  // HİÇBİR KART ÇAKIŞMIYOR.
  expect(r.cakisma).toBe(0);
  // BLOK GENİŞ, DAR-UZUN DEĞİL: görüş alanı yatay (1316×855), sütun dizilişi
  // sığdırmayı yükseklikten sınırlayıp zoom'u 0,473'e düşürüyordu.
  expect(r.kutu.w).toBeGreaterThan(r.kutu.h);
}

test('örnek yüklenince: kanvaslar YAN YANA, künyeler solda', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await feadOrnek(page, false);
  const r = await olc(page);
  console.log('OLAĞAN ' + JSON.stringify(r.kutu));
  kapilar(r);
  expect(hatalar).toEqual([]);
});

test('YEDEK yol da yan yana — yerleştirici patlasa bile', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await feadOrnek(page, true);
  const r = await olc(page);
  console.log('YEDEK ' + JSON.stringify(r.kutu));
  kapilar(r);
  // Kurucu düğümleri kurabilmiş olmalı: yedek yol bir ÇÖKÜŞ değil.
  expect(await page.evaluate(() => window.nodes.filter((n) => n.type === 'fead-layout').length)).toBe(2);
  expect(hatalar).toEqual([]);
});
