/**
 * fead-baslangic.spec.js — FEAD BAŞLANGIÇ SAYFASI (gerçek tarayıcı)
 *
 * Kullanıcı kararı (2026-09-29, tasarım tuvali "İlk açılış" · B): *"İlk
 * açılış B başlangıç sayfası olacak."* İsteğin kendisi: *"FEAD modülünü açınca
 * sihirbaz anında karşımızda beliriyor. Bunun böyle olmasını istemiyorum."*
 *
 * ÖLÇÜLEN KUSUR (1440×900): sihirbaz ekranın %77'sini kaplıyor, arkayı %62
 * karartıyor ve ilk karede HATA gösteriyordu ("7 eksik/çelişkili girdi",
 * kırmızı "çözülemiyor"); kapatınca boş kartta kırmızı "Kayış yolu kapanmadı".
 *
 * Node'da HİÇ koşmayan halkalar: sayfanın gerçekten tuvali örtmesi ve
 * ana topolojiye dönüş düğmesinin onun ÜSTÜNDE tıklanabilir kalması,
 * tekerleğin sayfayı kaydırıp kadrajı oynatmaması, gerçek tıkla kurulum →
 * sayfanın çekilmesi → Ctrl+Z → geri gelmesi, STEP kapısının dosya seçiciyi
 * AYNI tıklamada açması. Birim tarafı: tests/unit/fead-baslangic.test.js.
 */
const { test, expect } = require('@playwright/test');
test.setTimeout(180000);

async function bootApp(page) {
  await page.goto('/index.html');
  await page.evaluate(() => {
    try { localStorage.removeItem('mfsim.fead.araclar'); } catch (e) { /* yok */ }
    if (window.MFSimLoader && typeof window.MFSimLoader.start === 'function') window.MFSimLoader.start();
  });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' && typeof window.veFeadOpenEditor === 'function' &&
    typeof window.veFeadBaslangicTazele === 'function' && Array.isArray(window.nodes),
    null, { timeout: 90000 });
  await page.evaluate(() => {
    if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans');
  });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none';
  }, null, { timeout: 90000 });
}
async function feadGir(page) {
  await page.evaluate(() => { const n = createNode('fead-analysis', 400, 300); veFeadOpenEditor(n.id); });
  await expect(page.locator('#ve-fead-baslangic')).toBeVisible();
}
const say = (page) => page.evaluate(() => ({
  kasnak: window.nodes.filter((n) => (componentDefs[n.type] || {}).isFeadPulley).length,
  kart: window.nodes.filter((n) => (componentDefs[n.type] || {}).isFeadLayout).length,
}));

test('AÇILIŞ: sihirbaz YOK, hata YOK — sayfa tuvali örter, dönüş düğmesi üstte', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootApp(page);
  await feadGir(page);

  await expect(page.locator('#ve-feadwiz-overlay')).toBeHidden();
  await expect(page.locator('#ve-fead-araclar')).toBeHidden();
  // İlk karede hata cümlesi ve kırmızı rozet yok.
  const metin = await page.evaluate(() => document.getElementById('ve-canvas-wrapper').innerText);
  expect(metin).not.toMatch(/eksik\/çelişkili|çözülemiyor|kapanmadı/i);
  await expect(page.locator('.ve-fead-kan-durum')).toHaveCount(0);

  const o = await page.evaluate(() => {
    const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; };
    const kap = r(document.getElementById('ve-canvas-wrapper'));
    const sayfa = r(document.getElementById('ve-fead-baslangic'));
    const btn = document.querySelector('#ve-fead-breadcrumb button');
    const bb = btn.getBoundingClientRect();
    const ust = document.elementFromPoint(bb.left + bb.width / 2, bb.top + bb.height / 2);
    return { kap, sayfa, donus: !!(ust && btn.contains(ust)),
      kapi: document.querySelectorAll('#ve-fead-baslangic .ve-fead-bas-kapi').length,
      karo: document.querySelectorAll('#ve-fead-baslangic .ve-fead-bas-karo').length,
      cizim: document.querySelectorAll('#ve-fead-baslangic .ve-fead-bas-resim [data-ve="belt"]').length,
      ornek: veFeadExampleKeys().length };
  });
  // Sayfa tuvalin TAMAMINI örter (ölçü kabınki).
  expect(Math.round(o.sayfa.w)).toBe(Math.round(o.kap.w));
  expect(Math.round(o.sayfa.h)).toBe(Math.round(o.kap.h));
  // Alt topolojiden çıkmanın tek yolu örtülmüyor: noktadaki öğe düğmenin kendisi.
  expect(o.donus).toBe(true);
  expect(o.kapi).toBe(3);
  expect(o.karo).toBe(o.ornek);
  expect(o.cizim).toBe(o.ornek);             // her rapor kayış yolunu çiziyor
  expect(hatalar).toEqual([]);
});

test('TEKERLEK sayfayı kaydırır, kadrajı oynatmaz', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await bootApp(page);
  await feadGir(page);
  const once = await page.evaluate(() => ({ z: canvasZoom, x: canvasOffset.x, y: canvasOffset.y,
    s: document.getElementById('ve-fead-baslangic').scrollTop,
    tasma: document.getElementById('ve-fead-baslangic').scrollHeight
         - document.getElementById('ve-fead-baslangic').clientHeight }));
  expect(once.tasma).toBeGreaterThan(0);     // 768'de sayfa kaydırılabilir
  const k = await page.locator('#ve-fead-baslangic .ve-fead-bas-karo').first().boundingBox();
  await page.mouse.move(k.x + k.width / 2, k.y + k.height / 2);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(300);
  const sonra = await page.evaluate(() => ({ z: canvasZoom, x: canvasOffset.x, y: canvasOffset.y,
    s: document.getElementById('ve-fead-baslangic').scrollTop }));
  expect(sonra.s).toBeGreaterThan(once.s);
  expect({ z: sonra.z, x: sonra.x, y: sonra.y }).toEqual({ z: once.z, x: once.x, y: once.y });
});

test('RAPOR KAROSU modeli kurar → sayfa çekilir, pencere gelir; Ctrl+Z → sayfa geri', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootApp(page);
  await feadGir(page);
  await page.locator('#ve-fead-baslangic .ve-fead-bas-karo[data-v="AG00976_GATES_2025"]').click();
  await page.waitForFunction(() =>
    window.nodes.filter((n) => (componentDefs[n.type] || {}).isFeadPulley).length === 6, null, { timeout: 20000 });
  await expect(page.locator('#ve-fead-baslangic')).toBeHidden();
  await expect(page.locator('#ve-fead-araclar')).toBeVisible();
  expect(await say(page)).toEqual({ kasnak: 6, kart: 2 });
  // Kurulum TEK geri-al adımı: bir Ctrl+Z açılışa döner ve sayfa geri gelir.
  await page.locator('#ve-canvas-wrapper').click({ position: { x: 900, y: 700 } });
  await page.keyboard.press('Control+z');
  await expect(page.locator('#ve-fead-baslangic')).toBeVisible();
  await expect(page.locator('#ve-fead-araclar')).toBeHidden();
  expect(await say(page)).toEqual({ kasnak: 0, kart: 0 });
  expect(hatalar).toEqual([]);
});

test('BOŞ ÇİZİM MASASI → kasnaksız kart, rozetsiz; sayfa geri gelmez', async ({ page }) => {
  await bootApp(page);
  await feadGir(page);
  await page.locator('#ve-fead-baslangic .ve-fead-bas-kapi[data-ey="bos"]').click();
  await page.waitForFunction(() => window.nodes.some((n) => n.type === 'fead-layout'), null, { timeout: 20000 });
  await expect(page.locator('#ve-fead-baslangic')).toBeHidden();
  await expect(page.locator('#ve-fead-araclar')).toBeVisible();
  expect(await say(page)).toEqual({ kasnak: 0, kart: 1 });
  await expect(page.locator('.ve-fead-kan-bos')).toContainText('henüz kasnak yok');
  await expect(page.locator('.ve-fead-kan-durum')).toHaveCount(0);
  // Başka bir alt topolojiye gidip dönmek sayfayı geri getirmez: kart var.
  await page.evaluate(() => veFeadCloseEditor());
  await page.waitForTimeout(300);
  await page.evaluate(() => veFeadOpenEditor(window.nodes.find((n) => n.type === 'fead-analysis').id));
  await page.waitForTimeout(400);
  await expect(page.locator('#ve-fead-baslangic')).toBeHidden();
  await expect(page.locator('#ve-fead-araclar')).toBeVisible();
});

test('SİHİRBAZ kapısı sihirbazı açar; STEP kapısı dosya seçiciyi AYNI tıklamada açar', async ({ page }) => {
  await bootApp(page);
  await feadGir(page);
  await page.locator('#ve-fead-baslangic .ve-fead-bas-kapi[data-ey="sihirbaz"]').click();
  await expect(page.locator('#ve-feadwiz-overlay')).toBeVisible();
  await page.evaluate(() => veFeadWizClose(false));
  await expect(page.locator('#ve-feadwiz-overlay')).toBeHidden();
  // Sihirbazı kapatan kullanıcı sayfaya döner — model kurulmadı.
  await expect(page.locator('#ve-fead-baslangic')).toBeVisible();

  const secici = page.waitForEvent('filechooser', { timeout: 5000 });
  await page.locator('#ve-fead-baslangic .ve-fead-bas-kapi[data-ey="step"]').click();
  const fc = await secici;
  expect(fc.isMultiple()).toBe(false);
  await expect(page.locator('#ve-feadwiz-overlay')).toBeVisible();
  // Sihirbaz 1. adımda, STEP kartı orada.
  await expect(page.locator('#ve-fw-body .ve-fw-stp-file')).toHaveCount(1);
});
