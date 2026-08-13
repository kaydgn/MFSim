/**
 * Araç Performans alt-sistem (subsystem) düğümü — E2E (Playwright)
 *
 * "Araç Performans" ana canvas'ta TEK bir composite düğümdür. Çift tıklanınca
 * kendi ALT TOPOLOJİSİ açılır; "← Ana Topolojiye Dön" ile geri çıkılır ve
 * alt-topoloji düğümün data'sında saklanır. Alt topoloji BOŞ başlar: yalnız
 * "Başlangıç ve Örnekler" (ap-example) düğümü gelir (Takoz modülüyle aynı
 * kalıp). Zinciri kullanıcı ya oradan aktarır ya da kendisi kurar.
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
    typeof window.veAracPopulateStarter === 'function' &&
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
    // "Modüller" bölümünde birden çok alt-sistem olabilir → Araç Performans'ı hedefle
    const item = page.locator('.ve-submodule[data-type="arac-performans"]');
    await expect(item).toBeVisible();
    await expect(item).toHaveAttribute('draggable', 'true');
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

    // İç topoloji YALNIZ "Başlangıç ve Örnekler" ile başlar (hazır zincir YOK)
    await page.waitForFunction(
      () => window.veAracStack.length === 1 && window.nodes.length === 1 &&
            window.nodes[0].type === 'ap-example',
      null, { timeout: 10000 }
    );

    const inside = await page.evaluate(() => ({
      nodes: nodes.length,
      connections: connections.length,
      types: nodes.map(n => n.type),
      hasAracNode: nodes.some(n => n.type === 'arac-performans')
    }));
    expect(inside.nodes).toBe(1);
    expect(inside.connections).toBe(0);
    expect(inside.types).toEqual(['ap-example']);
    expect(inside.hasAracNode).toBe(false); // iç topolojide composite düğüm yok

    // Başlangıç düğümü görünümün ORTASINDA (veFitViewToContent) — kenarda değil
    const centered = await page.evaluate(() => {
      const wrap = document.getElementById('ve-canvas-wrapper').getBoundingClientRect();
      const el = document.querySelector('#ve-canvas .ve-node').getBoundingClientRect();
      return { dx: (el.left + el.right) / 2 - (wrap.left + wrap.right) / 2,
               dy: (el.top + el.bottom) / 2 - (wrap.top + wrap.bottom) / 2 };
    });
    expect(Math.abs(centered.dx)).toBeLessThan(3);
    expect(Math.abs(centered.dy)).toBeLessThan(3);

    // Breadcrumb görünür + iç canvas'ta tek .ve-node
    await expect(page.locator('.ve-arac-breadcrumb')).toBeVisible();
    await expect(page.locator('#ve-canvas .ve-node')).toHaveCount(1);

    // "← Ana Topolojiye Dön"
    await page.locator('.ve-arac-breadcrumb button').click();
    await page.waitForFunction(() => window.veAracStack.length === 0 && window.nodes.length === 1,
      null, { timeout: 10000 });

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
    expect(outside.subNodes).toBe(1);    // alt-topoloji düğümün data'sında saklandı
    expect(outside.subConns).toBe(0);

    // Ana canvas tekrar tek blok; breadcrumb kayboldu
    await expect(page.locator('#ve-canvas .ve-node')).toHaveCount(1);
    await expect(page.locator('.ve-arac-breadcrumb')).toHaveCount(0);
  });

  test('yeniden açınca kaydedilmiş alt topoloji geri yüklenir', async ({ page }) => {
    await bootApp(page);
    await page.evaluate(() => { createNode('arac-performans', 3200, 3200); });
    await page.waitForFunction(() => window.nodes.length === 1, null, { timeout: 5000 });

    // Aç → içeride bir bileşen EKLE (2 olsun) → geri dön
    await page.locator('#ve-canvas .ve-node[data-type="arac-performans"]').dblclick();
    await page.waitForFunction(() => window.veAracStack.length === 1 && window.nodes.length === 1,
      null, { timeout: 10000 });
    await page.evaluate(() => { createNode('engine', 3400, 3100); });
    await page.waitForFunction(() => window.nodes.length === 2, null, { timeout: 5000 });
    await page.locator('.ve-arac-breadcrumb button').click();
    await page.waitForFunction(() => window.veAracStack.length === 0 && window.nodes.length === 1,
      null, { timeout: 10000 });

    // Tekrar aç → 2 düğüm geri yüklenmeli (yeniden başlangıç düğümüne dönmemeli)
    await page.locator('#ve-canvas .ve-node[data-type="arac-performans"]').dblclick();
    await page.waitForFunction(() => window.nodes.length === 2, null, { timeout: 10000 });
    const again = await page.evaluate(() => nodes.map(n => n.type).sort());
    expect(again).toEqual(['ap-example', 'engine']);
  });

  test('sidebar kapsamı: üst seviyede yalnızca Modüller, modül içinde bileşenler', async ({ page }) => {
    await bootApp(page);

    const catVisible = (title) => page.evaluate((t) => {
      var cats = Array.prototype.slice.call(document.querySelectorAll('.ve-category'));
      var cat = cats.find(function (c) {
        var el = c.querySelector('.ve-category-title');
        return el && el.textContent.trim() === t;
      });
      if (!cat) return null;
      return getComputedStyle(cat).display !== 'none';
    }, title);

    // Üst seviye: "Modüller" görünür; güç aktarma bileşenleri + Takoz Alt Bileşenleri gizli
    expect(await catVisible('Modüller')).toBe(true);
    expect(await catVisible('Güç Kaynağı')).toBe(false);
    expect(await catVisible('Ölçüm')).toBe(false);
    expect(await catVisible('Takoz Alt Bileşenleri')).toBe(false);

    // Araç Performans bloğunu aç
    // Kanvas uzayının merkezi 3000,3000 (CSS'te -3000 px kaydırma, bkz.
    // js/canvas-space.js). Düğüm 560,360'a konursa görünür alanın DIŞINDA
    // kalıyor ve Playwright ona hiç tıklayamıyordu — bu testin tek arızası
    // buydu: eski koordinat düzeninden kalma bir sayı. Diğer testler zaten
    // 3200,3200 kullanıyor.
    await page.evaluate(() => { createNode('arac-performans', 3200, 3200); });
    await page.waitForFunction(() => window.nodes.length === 1, null, { timeout: 5000 });
    await page.locator('#ve-canvas .ve-node[data-type="arac-performans"]').dblclick();
    await page.waitForFunction(() => window.veAracStack.length === 1 && window.nodes.length === 1,
      null, { timeout: 10000 });

    // Modül içi: güç aktarma bileşenleri görünür; Takoz gizli.
    // "Modüller" de GİZLİ — modül içinde modül açılmaz (js/components.js
    // veShowAllSidebarComponents, 'module' kapsam kuralı). Test eskiden
    // burada `true` bekliyordu; o beklenti kuraldan ÖNCEYE ait ve kırmızı
    // yanan şey uygulamanın hatası değil testin kendisiydi.
    expect(await catVisible('Güç Kaynağı')).toBe(true);
    expect(await catVisible('Ölçüm')).toBe(true);
    expect(await catVisible('Takoz Alt Bileşenleri')).toBe(false);
    expect(await catVisible('Modüller')).toBe(false);

    // Geri dön → üst seviye kapsamı
    await page.locator('.ve-arac-breadcrumb button').click();
    await page.waitForFunction(() => window.veAracStack.length === 0 && window.nodes.length === 1,
      null, { timeout: 10000 });
    expect(await catVisible('Güç Kaynağı')).toBe(false);
  });

  // Çıkış çipi eskiden GÖRÜNÜMÜN alt-ortasına dock'luydu: diyagramdan kopuk,
  // ilgisiz bir boşlukta duruyordu ve pan ettikçe daha da uzaklaşıyordu.
  // Bu test ESKİ kodda kırmızı: çerçevenin alt kenarına uzaklık 252.5px
  // (beklenen < 20px) ölçüldü. Buradaki kapı wiring'i tutar — konum
  // matematiği ayrıca birim testli (canvas-space.test.js → veBoundaryChipPos).
  test('çıkış çipi sınır çerçevesinin alt kenarına tutunur; pan/zoom onu koparmaz', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await bootApp(page);
    await page.evaluate(() => { createNode('arac-performans', 3200, 3200); });
    await page.waitForFunction(() => window.nodes.length === 1, null, { timeout: 5000 });
    await page.locator('#ve-canvas .ve-node[data-type="arac-performans"]').dblclick();
    await page.waitForFunction(() => window.veAracStack.length === 1 && window.nodes.length === 1,
      null, { timeout: 10000 });
    await expect(page.locator('.ve-arac-breadcrumb')).toBeVisible();

    // Çipin üst kenarı ↔ çerçevenin alt kenarı ve yatay merkez sapması
    const probe = () => page.evaluate(() => {
      const chip = document.querySelector('.ve-arac-breadcrumb').getBoundingClientRect();
      const frame = document.querySelector('.ve-boundary-rect').getBoundingClientRect();
      return { gap: chip.top - frame.bottom, dx: (chip.left + chip.right) / 2 - (frame.left + frame.right) / 2 };
    });

    const atEntry = await probe();
    expect(atEntry.gap).toBeLessThan(20);          // çerçeveye YAPIŞIK (eskiden 595)
    expect(Math.abs(atEntry.dx)).toBeLessThan(2);  // çerçeveyle ortalı (eskiden 858)

    // Pan: çip çerçeveyle birlikte gider — aradaki mesafe değişmez.
    // Tolerans 1px: çerçeve bir SVG rect ve getBoundingClientRect'i çizgi
    // kalınlığının yarısını da sayıyor; kesirli cihaz pikselinde ~0.5px oynar.
    await page.evaluate(() => { canvasOffset.x += 260; canvasOffset.y -= 170; updateCanvasTransform(); });
    const panned = await probe();
    expect(Math.abs(panned.gap - atEntry.gap)).toBeLessThan(1);
    expect(Math.abs(panned.dx - atEntry.dx)).toBeLessThan(1);

    // Zoom: tutunma korunur, çipin KENDİ ölçüsü ölçekten etkilenmez.
    // Burada tolerans 1.5px: çizgi kalınlığı da ölçekleniyor (1.5px → 0.75px),
    // yani çerçevenin ölçülen alt kenarı zoom ile ~0.4px kayıyor.
    const wBefore = await page.evaluate(() => document.querySelector('.ve-arac-breadcrumb').getBoundingClientRect().width);
    await page.evaluate(() => { canvasZoom = 0.5; updateCanvasTransform(); });
    const zoomed = await probe();
    expect(Math.abs(zoomed.gap - atEntry.gap)).toBeLessThan(1.5);
    expect(Math.abs(zoomed.dx)).toBeLessThan(2);
    const wAfter = await page.evaluate(() => document.querySelector('.ve-arac-breadcrumb').getBoundingClientRect().width);
    expect(Math.abs(wAfter - wBefore)).toBeLessThan(1);

    // Çerçeve ekran dışına kaydırılsa BİLE çip görünümde kalmalı: alt
    // topolojiden çıkmanın başka yolu yok, kırpma olmasa kullanıcı kilitlenirdi.
    await page.evaluate(() => { canvasZoom = 1; canvasOffset.y += 3000; updateCanvasTransform(); });
    await page.locator('.ve-arac-breadcrumb button').click({ timeout: 5000 });
    await page.waitForFunction(() => window.nodes.length === 1, null, { timeout: 10000 });
    expect(await page.evaluate(() => veAracStack.length)).toBe(0);
  });
});
