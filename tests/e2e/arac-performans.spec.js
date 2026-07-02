/**
 * Araç Performans alt-sistem (subsystem) düğümü — E2E (Playwright)
 *
 * "Araç Performans" ana canvas'ta TEK bir composite düğümdür. Çift tıklanınca
 * kendi ALT TOPOLOJİSİ (gerçek güç aktarma bileşenleri) açılır; "← Ana Topolojiye
 * Dön" ile geri çıkılır ve alt-topoloji düğümün data'sında saklanır.
 *
 * Not: Uygulama şifre-korumalı; test modül yüklemesini login sonrası akışı taklit
 * ederek (MFSimLoader.start) tetikler.
 */
const { test, expect } = require('@playwright/test');

async function bootApp(page) {
  await page.goto('/index.html');
  await page.evaluate(() => {
    if (window.MFSimLoader && typeof window.MFSimLoader.start === 'function') window.MFSimLoader.start();
  });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' &&
    typeof window.veAracOpenEditor === 'function' &&
    typeof window.veAracPopulateDrivetrain === 'function' &&
    Array.isArray(window.nodes),
    null, { timeout: 60000 });
  await page.evaluate(() => {
    if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans');
  });
  await page.waitForFunction(() => {
    var s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none';
  }, null, { timeout: 60000 });
}

test.describe('Araç Performans — alt-sistem düğümü', () => {
  test.setTimeout(120000);

  test('sidebar öğesi sürüklenebilir composite bileşendir', async ({ page }) => {
    await bootApp(page);
    const item = page.locator('.ve-submodule');
    await expect(item).toBeVisible();
    await expect(item).toHaveAttribute('draggable', 'true');
    await expect(item).toHaveAttribute('data-type', 'arac-performans');
  });

  test('çift tık → alt topoloji açılır; geri dönünce tek blok kalır', async ({ page }) => {
    await bootApp(page);

    // Composite düğümü oluştur (drop handler ile aynı kod yolu)
    await page.evaluate(() => { createNode('arac-performans', 3200, 3200); });
    await page.waitForFunction(() => window.nodes.length === 1, null, { timeout: 5000 });

    let r = await page.evaluate(() => ({ n: nodes.length, type: nodes[0].type }));
    expect(r.n).toBe(1);
    expect(r.type).toBe('arac-performans');

    // Ana canvas'ta TEK .ve-node render edildi
    await expect(page.locator('#ve-canvas .ve-node')).toHaveCount(1);

    // Çift tık → iç topolojiye gir
    await page.locator('#ve-canvas .ve-node[data-type="arac-performans"]').dblclick();

    // İç topoloji hazır preset ile dolar (16 düğüm + 11 bağlantı)
    await page.waitForFunction(
      () => window.nodes.length === 16 && window.connections.length === 11,
      null, { timeout: 10000 }
    );

    const inside = await page.evaluate(() => ({
      nodes: nodes.length,
      connections: connections.length,
      wheels: nodes.filter(n => n.type === 'wheel').length,
      diffs: nodes.filter(n => n.type === 'differential').length,
      hasAracNode: nodes.some(n => n.type === 'arac-performans'),
      connIds: connections.map(c => c.id)
    }));
    expect(inside.nodes).toBe(16);
    expect(inside.connections).toBe(11);
    expect(inside.wheels).toBe(4);
    expect(inside.diffs).toBe(2);
    expect(inside.hasAracNode).toBe(false); // iç topolojide composite düğüm yok
    expect(new Set(inside.connIds).size).toBe(inside.connIds.length); // benzersiz id

    // Breadcrumb görünür + iç canvas'ta 16 .ve-node
    await expect(page.locator('.ve-arac-breadcrumb')).toBeVisible();
    await expect(page.locator('#ve-canvas .ve-node')).toHaveCount(16);

    // "← Ana Topolojiye Dön"
    await page.locator('.ve-arac-breadcrumb button').click();
    await page.waitForFunction(() => window.nodes.length === 1, null, { timeout: 10000 });

    const outside = await page.evaluate(() => {
      var node = nodes.find(n => n.type === 'arac-performans');
      var sub = node && node.data && node.data.subTopology;
      return {
        n: nodes.length,
        type: node ? node.type : null,
        subNodes: sub && sub.nodes ? sub.nodes.length : 0,
        subConns: sub && sub.connections ? sub.connections.length : 0
      };
    });
    expect(outside.n).toBe(1);
    expect(outside.type).toBe('arac-performans');
    expect(outside.subNodes).toBe(16);   // alt-topoloji düğümün data'sında saklandı
    expect(outside.subConns).toBe(11);

    // Ana canvas tekrar tek blok; breadcrumb kayboldu
    await expect(page.locator('#ve-canvas .ve-node')).toHaveCount(1);
    await expect(page.locator('.ve-arac-breadcrumb')).toHaveCount(0);
  });

  test('yeniden açınca kaydedilmiş alt topoloji geri yüklenir', async ({ page }) => {
    await bootApp(page);
    await page.evaluate(() => { createNode('arac-performans', 3200, 3200); });
    await page.waitForFunction(() => window.nodes.length === 1, null, { timeout: 5000 });

    // Aç → içeride bir bileşen EKLE (17 olsun) → geri dön
    await page.locator('#ve-canvas .ve-node[data-type="arac-performans"]').dblclick();
    await page.waitForFunction(() => window.nodes.length === 16, null, { timeout: 10000 });
    await page.evaluate(() => { createNode('sensor', 3400, 3100); });
    await page.waitForFunction(() => window.nodes.length === 17, null, { timeout: 5000 });
    await page.locator('.ve-arac-breadcrumb button').click();
    await page.waitForFunction(() => window.nodes.length === 1, null, { timeout: 10000 });

    // Tekrar aç → 17 düğüm geri yüklenmeli (yeniden preset ile 16'ya dönmemeli)
    await page.locator('#ve-canvas .ve-node[data-type="arac-performans"]').dblclick();
    await page.waitForFunction(() => window.nodes.length === 17, null, { timeout: 10000 });
    const again = await page.evaluate(() => nodes.length);
    expect(again).toBe(17);
  });
});
