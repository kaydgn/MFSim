/**
 * panel-tablo.spec.js — PANEL VERİ TABLOSU DURUM İFADE EDİYOR MU?
 * ──────────────────────────────────────────────────────────────────
 *
 * ÖLÇÜLEN KUSUR (2026-09-22): panellerde 31 veri tablosu kendi yapışkan
 * başlığını, kenarlığını ve dolgusunu SATIR İÇİ yazıyordu. Satır içi CSS
 * durum ifade edemez — `:hover` yazılamaz — yani vites oranları ya da
 * takoz koordinatları okunurken "hangi satırdayım" sorusunun cevabı YOKTU.
 *
 * Kayış Tablosu'nu kart listesine çeviren gerekçenin aynısı.
 *
 * Node'da koşamaz: jsdom `:hover`ı HİÇ hesaplamaz ve `position:sticky`nin
 * yerleşimini çözmez.
 */
const { test, expect } = require('@playwright/test');

async function vitesPaneliAc(page) {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' && typeof window.veTogglePropertiesPanel === 'function' &&
    Array.isArray(window.nodes), null, { timeout: 90000 });
  await page.evaluate(() => {
    if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans');
  });
  await page.waitForFunction(() =>
    typeof window.updateNodeHandles === 'function' && typeof window.addToSelection === 'function',
  null, { timeout: 90000 });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || getComputedStyle(s).display === 'none';
  }, null, { timeout: 90000 });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const n = createNode('gearbox', 400, 300);
    clearSelection(); addToSelection(n);
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => veTogglePropertiesPanel(true));
  await page.waitForFunction(() =>
    document.getElementById('ve-properties-overlay').classList.contains('visible'),
  null, { timeout: 10000 });
  await page.waitForTimeout(400);
}

test('panel tablosu kuruluyor ve satır FAREYE tepki veriyor', async ({ page }) => {
  await vitesPaneliAc(page);

  const tablo = page.locator('.ve-properties-content table.ve-pnl-tbl').first();
  await expect(tablo).toBeVisible();

  const satir = tablo.locator('tbody tr').first();
  const dinlenme = await satir.evaluate((el) => getComputedStyle(el).backgroundColor);
  await satir.hover();
  await page.waitForTimeout(150);
  const uzerinde = await satir.evaluate((el) => getComputedStyle(el).backgroundColor);

  // SATIR İÇİ CSS'İN İFADE EDEMEDİĞİ ŞEY: fare satırın zeminini değiştiriyor.
  expect(uzerinde).not.toBe(dinlenme);
  expect(uzerinde).not.toMatch(/rgba\(0,\s*0,\s*0,\s*0\)/);
});

test('başlık YAPIŞKAN ve hücreler sınıftan biçim alıyor', async ({ page }) => {
  await vitesPaneliAc(page);
  const r = await page.evaluate(() => {
    // Panelde birden çok tablo var ve hepsinin `thead`i YOK — başlığı olanı seç.
    const t = [].slice.call(document.querySelectorAll('.ve-properties-content table.ve-pnl-tbl'))
      .find((x) => x.querySelector('thead th') && x.querySelector('tbody td'));
    if (!t) return { yok: true };
    const th = t.querySelector('thead th');
    const td = t.querySelector('tbody td');
    const cs = getComputedStyle(th), cd = getComputedStyle(td);
    return {
      yapiskan: cs.position, ustu: cs.top,
      basZemin: cs.backgroundColor,
      hucreDolgu: cd.padding, hucreAltCizgi: cd.borderBottomWidth,
      // Satır içi `style` yalnız VERİ taşıyabilir (sütun genişliği gibi);
      // sunum (dolgu · kenarlık · zemin · hiza) sınıftan gelir.
      thSatirIci: th.getAttribute('style'),
      tdSatirIci: td.getAttribute('style'),
    };
  });
  expect(r.yok).toBeUndefined();      // başlıklı tablo GERÇEKTEN var
  expect(r.yapiskan).toBe('sticky');
  expect(r.ustu).toBe('0px');
  expect(r.basZemin).not.toMatch(/rgba\(0,\s*0,\s*0,\s*0\)/);
  expect(r.hucreDolgu).not.toBe('0px');
  expect(r.hucreAltCizgi).toBe('1px');
  // SUNUM sınıftan, VERİ satır içinde. `width:18%` bir sütun genişliğidir —
  // taşınamaz, çünkü her tablonun sütun payı kendine ait.
  const SUNUM = /padding|border|background|text-align|font-size|position|z-index/;
  [r.thSatirIci, r.tdSatirIci].forEach((st) => {
    if (st) expect(st).not.toMatch(SUNUM);
  });
});
