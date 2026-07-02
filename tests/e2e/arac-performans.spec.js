/**
 * Araç Performans alt modülü — E2E (Playwright)
 *
 * Sidebar'daki "Araç Performans" alt modül kartına tıklanınca resimdeki tam
 * güç aktarma topolojisinin (16 bileşen + 11 bağlantı) gerçek DOM'da kurulduğunu,
 * master ★ bayraklarının ve benzersiz bağlantı id'lerinin oluştuğunu doğrular.
 *
 * Not: Uygulama şifre-korumalı; test şifre plaintext'i bilmediğinden modül
 * yüklemesini login sonrası akışı taklit ederek (MFSimLoader.start) tetikler.
 */
const { test, expect } = require('@playwright/test');

test.describe('Alt Modül — Araç Performans', () => {
  test.setTimeout(90000);

  test('sidebar kartına tıklayınca tam topoloji kurulur', async ({ page }) => {
    await page.goto('/index.html');

    // Login'i geç → splash + modül yüklemesini başlat
    await page.evaluate(() => {
      if (window.MFSimLoader && typeof window.MFSimLoader.start === 'function') window.MFSimLoader.start();
    });

    // Modüller yüklensin (global fonksiyonlar tanımlansın)
    await page.waitForFunction(() =>
      typeof window.createNode === 'function' &&
      typeof window.createConnection === 'function' &&
      typeof window.veBuildVehiclePerformanceModule === 'function' &&
      Array.isArray(window.nodes),
      null, { timeout: 60000 });

    // Açılış modül seçim overlay'ını geç → performans moduna gir
    await page.evaluate(() => {
      if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans');
    });

    // Splash kapansın (tıklamayı engellemesin)
    await page.waitForFunction(() => {
      var s = document.getElementById('mfsim-loading-screen');
      return !s || s.style.display === 'none';
    }, null, { timeout: 60000 });

    const item = page.locator('.ve-submodule');
    await expect(item).toBeVisible();

    const nodesBefore = await page.evaluate(() => window.nodes.length);
    expect(nodesBefore).toBe(0);

    await item.click();

    // Kurulum tamamlansın
    await page.waitForFunction(
      () => window.nodes.length >= 16 && window.connections.length >= 11,
      null, { timeout: 10000 }
    );

    const r = await page.evaluate(() => ({
      nodes: nodes.length,
      connections: connections.length,
      masterDiffs: nodes.filter(n => n.type === 'differential' && n.isMasterDiff).length,
      masterWheels: nodes.filter(n => n.type === 'wheel' && n.isMasterWheel).length,
      connIds: connections.map(c => c.id),
      wheels: nodes.filter(n => n.type === 'wheel').length,
      diffs: nodes.filter(n => n.type === 'differential').length,
      hasEngineFanout: (() => {
        const e = nodes.find(n => n.type === 'engine');
        return connections.filter(c => c.from === e.id).length;
      })()
    }));

    expect(r.nodes).toBe(16);
    expect(r.connections).toBe(11);
    expect(r.wheels).toBe(4);
    expect(r.diffs).toBe(2);
    expect(r.masterDiffs).toBe(1);
    expect(r.masterWheels).toBe(1);
    expect(r.hasEngineFanout).toBe(2); // Motor çıkışı TC + Eşleştirme'ye
    // Bağlantı id'leri benzersiz (Date.now() çakışması düzeltildi)
    expect(new Set(r.connIds).size).toBe(r.connIds.length);

    // Gerçek DOM'da 16 düğüm render edildi
    await expect(page.locator('#ve-canvas .ve-node')).toHaveCount(16);
  });
});
