/**
 * mount-baslangic.spec.js — TAKOZ BAŞLANGIÇ SAYFASI (gerçek tarayıcı)
 *
 * Kullanıcı isteği (2026-10-14): *"FEAD modülünün başlangıç ekranı çok güzel,
 * aynı onun gibi bir ekran istiyorum. Takoz modülüne de 'Başlangıç Sihirbazı',
 * 'STEP dosyadan başlama' ve 'Boş kanvas' gibi özellikler kuracağız."*
 *
 * ÖLÇÜLEN ESKİ HÂL: modül açılınca iç topolojiye tek bir "Başlangıç ve
 * Örnekler" bileşeni kuruluyordu; ne yapılacağı ancak ona çift tıklayınca
 * görünüyordu.
 *
 * Node'da HİÇ koşmayan halkalar: sayfanın tuvali gerçekten örtmesi ve
 * ana topolojiye dönüş düğmesinin onun ÜSTÜNDE kalması, tekerleğin kadrajı
 * oynatmaması, gerçek tıkla kurulum → çekilme → Ctrl+Z → geri gelme, STEP
 * kapısının dosya seçiciyi AYNI tıklamada açması. Birim tarafı:
 * tests/unit/mount-baslangic.test.js · mount-wizard.test.js.
 */
const { test, expect } = require('@playwright/test');
const STEP = require('../helpers/step-takoz.js');
test.setTimeout(180000);

async function bootApp(page) {
  await page.goto('/index.html');
  await page.evaluate(() => {
    if (window.MFSimLoader && typeof window.MFSimLoader.start === 'function') window.MFSimLoader.start();
  });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' && typeof window.veMntOpenEditor === 'function' &&
    typeof window.veMntBaslangicTazele === 'function' && typeof window.veMntWizAc === 'function' &&
    typeof window.veMntStpOku === 'function' && Array.isArray(window.nodes),
    null, { timeout: 90000 });
  await page.evaluate(() => {
    if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans');
  });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none';
  }, null, { timeout: 90000 });
}
async function takozGir(page) {
  await page.evaluate(() => { const n = createNode('mount-analysis', 400, 300); veMntOpenEditor(n.id); });
  await expect(page.locator('#ve-mnt-baslangic')).toBeVisible();
}
const say = (page) => page.evaluate(() => ({
  hepsi: window.nodes.length,
  govde: window.nodes.filter((n) => (componentDefs[n.type] || {}).isMountBody).length,
  takoz: window.nodes.filter((n) => (componentDefs[n.type] || {}).isMount).length,
  ornek: window.nodes.filter((n) => n.type === 'mnt-example').length,
}));

test('AÇILIŞ: sayfa tuvali örter, dönüş düğmesi üstte, düğüm KURULMAZ', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootApp(page);
  await takozGir(page);
  expect(await say(page)).toEqual({ hepsi: 0, govde: 0, takoz: 0, ornek: 0 });
  const o = await page.evaluate(() => {
    const r = (el) => { const b = el.getBoundingClientRect(); return { w: b.width, h: b.height }; };
    const btn = document.querySelector('#ve-mnt-breadcrumb button');
    const bb = btn.getBoundingClientRect();
    const ust = document.elementFromPoint(bb.left + bb.width / 2, bb.top + bb.height / 2);
    return { kap: r(document.getElementById('ve-canvas-wrapper')), sayfa: r(document.getElementById('ve-mnt-baslangic')),
      donus: !!(ust && btn.contains(ust)),
      kapi: [...document.querySelectorAll('#ve-mnt-baslangic .ve-bas-kapi')].map((b) => b.getAttribute('data-ey')),
      karo: document.querySelectorAll('#ve-mnt-baslangic .ve-bas-karo').length,
      cizim: document.querySelectorAll('#ve-mnt-baslangic .ve-bas-resim svg.ve-mnt2d-gorunus').length,
      ornek: veMountCore.getMountExampleList().length };
  });
  expect(Math.round(o.sayfa.w)).toBe(Math.round(o.kap.w));
  expect(Math.round(o.sayfa.h)).toBe(Math.round(o.kap.h));
  expect(o.donus).toBe(true);
  expect(o.kapi).toEqual(['sihirbaz', 'step', 'bos']);
  expect(o.karo).toBe(o.ornek);
  expect(o.cizim).toBe(o.ornek);
  expect(hatalar).toEqual([]);
});

test('TEKERLEK sayfayı kaydırır, kadrajı oynatmaz', async ({ page }) => {
  // Kısa pencere: sayfanın içeriği sığmasın (1366×600'de sığıyor — ölçüldü)
  await page.setViewportSize({ width: 1200, height: 460 });
  await bootApp(page);
  await takozGir(page);
  expect(await page.evaluate(() => { const e = document.getElementById('ve-mnt-baslangic'); return e.scrollHeight > e.clientHeight; })).toBe(true);
  const once = await page.evaluate(() => ({ z: canvasZoom, x: canvasOffset.x, y: canvasOffset.y }));
  await page.mouse.move(700, 300);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(200);
  const sonra = await page.evaluate(() => ({ z: canvasZoom, x: canvasOffset.x, y: canvasOffset.y,
    kay: document.getElementById('ve-mnt-baslangic').scrollTop }));
  expect({ z: sonra.z, x: sonra.x, y: sonra.y }).toEqual(once);
  expect(sonra.kay).toBeGreaterThan(0);
});

test('BOŞ KANVAS: araçlar kurulur, sayfa çekilir; Ctrl+Z sayfayı geri getirir', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootApp(page);
  await takozGir(page);
  await page.click('#ve-mnt-baslangic .ve-bas-kapi[data-ey="bos"]');
  await expect(page.locator('#ve-mnt-baslangic')).toBeHidden();
  const s = await page.evaluate(() => ({ tip: nodes.map((n) => n.type).sort(), beklenen: VE_MNT_ARAC_TIPLERI.slice().sort() }));
  expect(s.tip).toEqual(s.beklenen);
  await page.locator('#ve-canvas-wrapper').click({ position: { x: 40, y: 300 } });
  await page.keyboard.press('Control+z');
  await expect(page.locator('#ve-mnt-baslangic')).toBeVisible();
  expect((await say(page)).hepsi).toBe(0);
});

test('ÖRNEK KARO: model birebir yüklenir, sayfa çekilir; Ctrl+Z TEK adımda geri alır', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootApp(page);
  await takozGir(page);
  await page.evaluate(() => { window.confirm = () => true; });
  await page.click('#ve-mnt-baslangic .ve-bas-karo[data-v="tulga"]');
  await expect(page.locator('#ve-mnt-baslangic')).toBeHidden();
  await page.waitForFunction(() => window.nodes.some((n) => n.type === 'mnt-mount'), null, { timeout: 15000 });
  const s = await say(page);
  expect(s.govde).toBeGreaterThan(0);
  expect(s.takoz).toBeGreaterThanOrEqual(3);
  await page.locator('#ve-canvas-wrapper').click({ position: { x: 20, y: 600 } });
  await page.keyboard.press('Control+z');
  await expect(page.locator('#ve-mnt-baslangic')).toBeVisible();
  expect((await say(page)).hepsi).toBe(0);
});

test('SİHİRBAZ KAPISI: pencere FEAD sihirbazının kabuğuyla açılır, Esc kapatır', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootApp(page);
  await takozGir(page);
  await page.click('#ve-mnt-baslangic .ve-bas-kapi[data-ey="sihirbaz"]');
  await expect(page.locator('#ve-mntwiz-overlay')).toBeVisible();
  const ray = await page.evaluate(() => [...document.querySelectorAll('#ve-mw-nav .ve-fw-step-t b')].map((b) => b.textContent));
  expect(ray).toEqual(await page.evaluate(() => VE_MW_STEPS.map((s) => s.ad)));
  await expect(page.locator('#ve-mw-title')).toContainText('Takoz Başlangıç Sihirbazı');
  await page.keyboard.press('Escape');
  await expect(page.locator('#ve-mntwiz-overlay')).toBeHidden();
  await expect(page.locator('#ve-mnt-baslangic')).toBeVisible();
});

test('STEP KAPISI: dosya seçici AYNI tıklamada açılır, okunan montaj kartta', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootApp(page);
  await takozGir(page);
  const [fc] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 5000 }),
    page.click('#ve-mnt-baslangic .ve-bas-kapi[data-ey="step"]'),
  ]);
  await expect(page.locator('#ve-mntwiz-overlay')).toBeVisible();
  await fc.setFiles({ name: 'guc.stp', mimeType: 'application/octet-stream', buffer: Buffer.from(STEP.gucGrubu()) });
  await page.waitForFunction(() => { const s = veMntWizStp(); return s && s.durum === 'hazir'; }, null, { timeout: 30000 });
  // 3B görüntüleyici dosya okununca açılır (WebGL varsa); kart onun altında.
  await page.evaluate(() => { if (typeof veMntWiz3bKapat === 'function') veMntWiz3bKapat(); });
  await expect(page.locator('#ve-mw-body .ve-fw-stp .ve-fw-seeded b').first()).toHaveText('guc.stp');
  expect(await page.locator('#ve-mw-body table.ve-mw-tbl-stp tbody tr').count()).toBe(9);
});
