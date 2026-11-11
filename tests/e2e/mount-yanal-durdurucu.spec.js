/**
 * mount-yanal-durdurucu.spec.js — Takoz penceresinin DURDURUCU bölümü (F006, gerçek tarayıcı)
 * Tulga'nın ön takozu: Yanal boşluk 12 mm, kaynağı alanın ipucunda; alan çözüme girer
 * (boşaltınca kaldırım durumunda ön takoz 12 mm'yi aşar).
 */
const { test, expect } = require('@playwright/test');
test.setTimeout(180000);
test.use({ serviceWorkers: 'block' });

test('Durdurucu bölümü: Yanal boşluk alanı, Tulga ön takozunda 12 mm ve künyesi; çözüme girer', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 952 });
  page.on('dialog', (d) => d.accept());
  await page.route('**/assets/examples/*.png', (r) => r.fulfill({ status: 404, body: '' }));
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await page.waitForFunction(() => typeof window.veMntOrnekYukle === 'function' && Array.isArray(window.nodes), null, { timeout: 90000 });
  await page.evaluate(() => { if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans'); });
  await page.waitForFunction(() => { const s = document.getElementById('mfsim-loading-screen'); return !s || s.style.display === 'none'; }, null, { timeout: 90000 });
  await page.evaluate(() => veMntOrnekYukle('tulga'));
  await page.waitForFunction(() => nodes.some((n) => n.customName === 'Sağ Ön Takoz'), null, { timeout: 20000 });
  const id = await page.evaluate(() => {
    const n = nodes.find((x) => x.customName === 'Sağ Ön Takoz');
    clearSelection(); addToSelection(n); veTogglePropertiesPanel(true); showNodeProperties(n);
    return n.id;
  });
  const alan = page.locator('#ve-mnt-bosY-' + id);
  await expect(alan).toBeVisible();
  expect(await alan.inputValue()).toBe('12');
  expect(await alan.getAttribute('title')).toMatch(/Adams/);
  const bolum = await alan.evaluate((el) => {
    const b = el.closest('.ve-fp-bolum, section, [class*="bolum"]');
    return b ? b.textContent : '';
  });
  expect(bolum).toMatch(/Durdurucu/);

  const kerb = () => page.evaluate((nid) => {
    const R = _mntComputeResults(nodes.find((n) => n.type === 'mnt-solver').id);
    const i = R.mounts.findIndex((m) => m.id === nid);
    const r = R.allCases.find((c) => c.name === 'Kerb Strike R').res;
    return { d: Math.abs(r.perMount[i].delta[1] * 1000), n: r.checks.clampYCount };
  }, id);
  const once = await kerb();
  expect(once.d).toBeLessThan(12.02);
  expect(once.n).toBe(2);
  await alan.fill(''); await alan.dispatchEvent('change');
  expect(await page.evaluate((nid) => nodes.find((n) => n.id === nid).data.bosY, id)).toBeFalsy();
  const sonra = await kerb();
  expect(sonra.n).toBe(1);                         // eşi (Sol Ön) hâlâ durdurucuda
  expect(sonra.d).toBeGreaterThan(once.d);
});
