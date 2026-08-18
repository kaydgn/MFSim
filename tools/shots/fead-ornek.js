/**
 * Senaryo: FEAD iç topolojisi + BMC tedarikçi örneği (kayış yolu kartı dolu).
 *
 * Kullanım:
 *   npm run shot -- --module fead-analysis --script tools/shots/fead-ornek.js \
 *                   --out .shots/sonrasi.png
 *
 * Senaryo dosyası sözleşmesi: `module.exports = async function(page, ctx)`.
 * ctx = { base, root, opt }. Playwright `page` nesnesinin tamamı kullanılabilir.
 */
module.exports = async function(page) {
  await page.locator('#ve-canvas .ve-node[data-type="fead-analysis"]').dblclick();
  await page.waitForFunction(function() { return typeof window.veFeadLoadExample === 'function'; },
    null, { timeout: 30000 });
  await page.evaluate(function() { veFeadLoadExample('BMC_FEAD_2026'); });
  // Kayış yolu kartı saveState() üzerinden tazeleniyor — çizim bitsin.
  await page.waitForTimeout(800);
};
