/**
 * kart-yuzey.spec.js — KANVAS KARTININ İÇİ: İKİ ORTAK KURAL, GERÇEK TARAYICIDA
 *
 * İki kural da ilk kullanıcısı olan Kayış Tablosu kartıyla ölçülmüştü; tablo
 * 2026-09-23'te kanvastan inince (Çizim Masası) kural KALDI, ölçüldüğü kart
 * gitti. Kapı artık SENTETİK bir kartla ölçüyor — kural bir karta değil
 * mekanizmaya ait (kökteki CLAUDE.md → "Ortak yüzey kuralları").
 *
 *   1) KARTIN EN KÜÇÜK ÖLÇÜSÜNÜ TİPİ SÖYLER (`componentDefs.minWidth/
 *      minHeight` → `js/node-resize.js` `veNodeMinSize`): gerçek tutamak
 *      sürüklemesi tabanda durur.
 *   2) KART İÇİNDEKİ KAYDIRILABİLİR YÜZEY TEKERLEĞİ ÖNCE ALIR
 *      (`js/ui-core.js` → `veWheelInnerPane`): kanvasın kayıtsız
 *      `preventDefault()`u yüzünden kart içindeki hiçbir liste
 *      kaydırılamıyordu (ölçüldü, 2026-09-11).
 *
 * İkisi de Node'da KOŞAMAZ: jsdom ne düzen kurar (taşma yok) ne gerçek bir
 * tekerlek olayının varsayılan eylemini çalıştırır, ne de fare zinciriyle
 * tutamak sürükler.
 */
const { test, expect } = require('@playwright/test');
test.setTimeout(120000);

async function ac(page) {
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await page.waitForFunction(() => typeof window.createNode === 'function' && Array.isArray(window.nodes),
    null, { timeout: 90000 });
  await page.evaluate(() => {
    if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans');
  });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none';
  }, null, { timeout: 90000 });
  // SENTETİK TİP: yalnız mekanizmanın okuduğu alanlar.
  return page.evaluate(() => {
    componentDefs['e2e-kart'] = { name: 'Deneme Kartı', inputs: 0, outputs: 0,
      defaultWidth: 420, defaultHeight: 260, minWidth: 300, minHeight: 180 };
    const n = createNode('e2e-kart', 3100, 3000);
    const w = document.getElementById('ve-canvas-wrapper');
    canvasZoom = 1;
    canvasOffset.x = w.clientWidth / 2 - (n.x + n.width / 2 - 3000);
    canvasOffset.y = w.clientHeight / 2 - (n.y + n.height / 2 - 3000);
    updateCanvasTransform();
    return n.id;
  });
}

test('EN KÜÇÜK ÖLÇÜ: gerçek tutamak sürüklemesi tipin tabanında duruyor', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  const id = await ac(page);
  await page.evaluate((i) => {
    clearSelection();
    addToSelection(window.nodes.find((n) => n.id === i));    // DÜĞÜM, DOM elemanı değil
  }, id);
  await page.waitForTimeout(200);
  const bb = await page.locator('#' + id + ' .ve-resize-se').boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.mouse.down();
  await page.mouse.move(bb.x - 1400, bb.y - 900, { steps: 14 });   // tabanın çok ötesine
  await page.mouse.up();
  await page.waitForTimeout(300);
  const o = await page.evaluate((i) => {
    const n = window.nodes.find((x) => x.id === i);
    return { w: Math.round(n.width), h: Math.round(n.height) };
  }, id);
  expect(o).toEqual({ w: 300, h: 180 });
  // Taban BEYAN ETMEYEN tip eski 50×50'de — kural karta değil tipe ait.
  expect(await page.evaluate(() => veNodeMinSize({ type: 'fead-solver' }))).toEqual({ w: 50, h: 50 });
  expect(hatalar).toEqual([]);
});

test('TEKERLEK: kart içindeki liste taşıyorsa LİSTEYİ kaydırır, taşmıyorsa kanvası', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  const id = await ac(page);
  // Kartın gövdesine kaydırılabilir bir liste koy (kanvas düğümlerinin
  // içeriği böyle kuruluyor: `.ve-node-box` içinde).
  await page.evaluate((i) => {
    const kutu = document.getElementById(i).querySelector('.ve-node-box');
    kutu.innerHTML = '<div id="e2e-liste" style="overflow:auto;height:120px">'
      + '<div style="height:600px">satırlar</div></div>'
      + '<div id="e2e-kisa" style="overflow:auto;height:60px"><div style="height:20px">kısa</div></div>';
  }, id);
  const zoom = () => page.evaluate(() => canvasZoom);

  // ── TAŞAN liste: tekerlek listenin, kanvas OYNAMAZ ─────────────────────
  const z0 = await zoom();
  await page.locator('#e2e-liste').hover();
  await page.mouse.wheel(0, 240);
  await page.waitForTimeout(250);
  expect(await page.locator('#e2e-liste').evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  expect(await zoom()).toBe(z0);

  // ── TAŞMAYAN kap: `overflow:auto` tek başına tekerleği YUTMAZ ───────────
  // Koşul ÇİFT: kaydırmaya izin veriyor VE içerik sığmıyor. Yalnız birincisi
  // olsaydı taşması olmayan her kap kart üstünde kanvası kilitlerdi.
  await page.locator('#e2e-kisa').hover();
  await page.mouse.wheel(0, 240);
  await page.waitForTimeout(250);
  expect(await zoom()).not.toBe(z0);
  expect(hatalar).toEqual([]);
});
