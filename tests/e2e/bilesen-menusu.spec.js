// @ts-check
// BİLEŞEN MENÜSÜ (kullanıcı 2026-11-11, Canlı Not 143: "Bileşenlere sağ tık olayını getirelim.
// Sağ tıklayınca işte silme, yeniden boyutlandırma falan filan neler olabilirse olsun. Güzel
// kullanışlı olsun."). Önce sağ tık yalnız port düzenini açıyordu. Node'da koşmayan halkalar:
// gerçek sağ tık menüyü imlecin yerinde açar ve bileşeni seçer, Büyük kutuyu gerçekten büyütür,
// tuvalde yeniden adlandırma, Sil + Ctrl+Z, Esc ve dışarı tık kapatır. Birim tarafı:
// tests/unit/bilesen-menusu.test.js.
const { test, expect } = require('@playwright/test');
test.setTimeout(120000);

async function bootApp(page) {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await page.waitForFunction(() => typeof window.createNode === 'function' && typeof window.veMntOrnekYukle === 'function'
    && Array.isArray(window.nodes), null, { timeout: 90000 });
  await page.evaluate(() => { if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans'); });
  await page.waitForFunction(() => { const s = document.getElementById('mfsim-loading-screen'); return !s || s.style.display === 'none'; }, null, { timeout: 90000 });
  await page.evaluate(() => veMntOrnekYukle('tulga'));
  await page.waitForFunction(() => nodes.some((n) => n.type === 'mnt-mount'), null, { timeout: 20000 });
  await page.waitForTimeout(400);
}
const kutu = (page, ad) => page.evaluate((a) => {
  const n = nodes.find((x) => (x.customName || x.def.name) === a);
  const r = document.getElementById(n.id).querySelector('.ve-node-box').getBoundingClientRect();
  return { id: n.id, x: r.left + r.width / 2, y: r.top + r.height / 2, w: Math.round(r.width), nw: n.width };
}, ad);

test('BİLEŞEN MENÜSÜ: sağ tık menüyü açar ve seçer; Büyük büyütür; adlandırma; Sil + Ctrl+Z; Esc kapatır', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);
  const m = await kutu(page, 'Motor');
  await page.mouse.click(m.x, m.y, { button: 'right' });
  const menu = page.locator('#ve-node-context-menu');
  await expect(menu).toBeVisible();
  const r = await menu.boundingBox();
  expect(Math.abs(r.x - m.x)).toBeLessThan(3);                                         // imlecin yerinde
  const ogeler = await menu.locator('.ve-context-item .ve-context-ad').allTextContents();
  expect(ogeler.slice(0, 4)).toEqual(['Aç', 'Yeniden adlandır', 'Çoğalt', 'Kopyala']);
  expect(ogeler).toContain('Yatay aynala');                                             // Motor portlu
  expect(ogeler[ogeler.length - 1]).toBe('Sil');
  expect(await page.evaluate((id) => selectedNodes.map((n) => n.id), m.id)).toEqual([m.id]);
  // Büyük: kutu 1,5 kat (varsayılan boyuttan)
  await menu.locator('.ve-context-seg-b', { hasText: 'Büyük' }).click();
  await expect(menu).toBeHidden();
  const m2 = await kutu(page, 'Motor');
  const d = await page.evaluate(() => veNodeDefaultSize('mnt-motor'));
  expect(m2.nw).toBe(Math.round(d.w * 1.5));
  expect(Math.abs(m2.w - m2.nw * (await page.evaluate(() => canvasZoom)))).toBeLessThan(2);
  // menü yeniden açılınca Büyük basılı
  await page.mouse.click(m2.x, m2.y, { button: 'right' });
  await expect(menu.locator('.ve-context-seg-b[aria-checked="true"]').first()).toHaveText('Büyük');
  // Esc kapatır
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  // Yeniden adlandır: tuvalde, Enter uygular
  await page.mouse.click(m2.x, m2.y, { button: 'right' });
  await menu.locator('.ve-context-item', { hasText: 'Yeniden adlandır' }).click();
  const inp = page.locator('#' + m.id + ' .ve-node-label input');
  await expect(inp).toBeFocused();
  await inp.fill('Ana motor');
  await page.keyboard.press('Enter');
  await expect(page.locator('#' + m.id + ' .ve-node-label')).toHaveText('Ana motor');
  // Sil bir takozu siler; Ctrl+Z geri getirir; dışarı tık menüyü kapatır
  const t = await kutu(page, 'Ön Takoz');
  const once = await page.evaluate(() => nodes.length);
  await page.mouse.click(t.x, t.y, { button: 'right' });
  await page.mouse.click(5, 450);
  await expect(menu).toBeHidden();
  await page.mouse.click(t.x, t.y, { button: 'right' });
  await menu.locator('.ve-context-item', { hasText: 'Sil' }).click();
  expect(await page.evaluate(() => nodes.length)).toBe(once - 1);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => nodes.length)).toBe(once);
  // Ctrl+Z YALNIZ silmeyi geri alır: silmeden önceki adlandırma yerinde (silme bir geri-al
  // adımı — eskiden yığına yazılmıyordu, Ctrl+Z adlandırmayı da geri alıyordu)
  await expect(page.locator('#' + m.id + ' .ve-node-label')).toHaveText('Ana motor');
  expect(hatalar).toEqual([]);
});

// SAĞ TIK PENCEREYİ SÜRMEZ (kullanıcı 2026-11-11, Canlı Not 156: "Sağ tıklayınca sağda pencere
// açılıyor sanki sol tık yapmışım gibi"). Eski hâl: Çözücü açıkken Motor'a sağ tık pencereyi
// Motor'a çeviriyordu. Birim tarafı: tests/unit/sag-tik-pencere.test.js.
test('SAĞ TIK PENCEREYİ SÜRMEZ: kapalı pencere kapalı, açık pencere konusunda; Aç açar, sol tık değiştirir', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);
  const menu = page.locator('#ve-node-context-menu');
  const baslik = page.locator('#ve-properties-title');
  // pencere kapalı: sağ tık yalnız menüyü açar
  let m = await kutu(page, 'Motor');
  await page.mouse.click(m.x, m.y, { button: 'right' });
  await expect(menu).toBeVisible();
  await page.waitForTimeout(300);
  await expect(page.locator('#ve-properties-overlay')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  // Çözücü çift tıkla açık; Motor'a sağ tık pencereyi Çözücü'de bırakır, menü Motor'a uygulanır
  const c = await kutu(page, 'Çözücü');
  await page.mouse.dblclick(c.x, c.y);
  await expect(baslik).toHaveText('Çözücü');
  m = await kutu(page, 'Motor');
  await page.mouse.click(m.x, m.y, { button: 'right' });
  await expect(menu).toBeVisible();
  await page.waitForTimeout(300);
  await expect(baslik).toHaveText('Çözücü');
  expect(await page.evaluate(() => selectedNodes.map((n) => n.id))).toEqual([m.id]);
  // menünün Aç'ı Motor'un penceresini açar
  await menu.locator('[data-action="ac"]').click();
  await expect(baslik).toHaveText('Motor');
  // sol tık eskisi gibi: açık pencerede içeriği yerinde değiştirir
  const c2 = await kutu(page, 'Çözücü');
  await page.mouse.click(c2.x, c2.y);
  await expect(baslik).toHaveText('Çözücü');
  expect(hatalar).toEqual([]);
});
