/**
 * fead-sonuclar.spec.js — FEAD SONUÇLAR SEKMESİ (gerçek tarayıcı)
 *
 * Node'da HİÇ koşmayan halkalar:
 *
 *   • BOŞ PANO SAYFA BOYU. Hiç çizilmemiş eksen tuvali (#ve-trace-axis)
 *     tarayıcının varsayılan 300×150 oranıyla genişliğe ölçekleniyordu —
 *     ölçüldü: 1160 px genişlikte 580 px, boş panonun alanı 932 → 332 px.
 *     Ortalı tek satırlık boş durum bunu gizliyordu; FEAD'in sayfa boyu
 *     başlangıç kartı kırpılınca göründü. jsdom yerleşim yapmaz.
 *   • `:has()` kuralı başlangıç kartını üstten akıtıyor (jsdom hesaplamaz).
 *   • Hazır diyagram GERÇEKTEN çiziyor: yüzey açılıyor, tuvalin boyu var,
 *     yorum şeridi görünür.
 *   • Çözücü penceresindeki "Sonuçlar'da aç" sayfayı değiştirip FEAD
 *     sekmesini açıyor ve müfettişi kapatıyor (açık kalsaydı panonun sağını
 *     örterdi — ölçüldü: 1600 px ekranda 380 px).
 */
const { test, expect } = require('@playwright/test');
test.setTimeout(180000);

async function feadCoz(page) {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(e.message));
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' && typeof window.veFeadOpenEditor === 'function' &&
    typeof window.veFeadResPreset === 'function' && Array.isArray(window.nodes), null, { timeout: 120000 });
  await page.evaluate(() => {
    if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans');
  });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none';
  }, null, { timeout: 120000 });
  await page.evaluate(() => { const n = createNode('fead-analysis', 400, 300); veFeadOpenEditor(n.id); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { if (typeof veFeadWizClose === 'function') veFeadWizClose(false); });
  await page.evaluate(() => veFeadLoadExample('AG00976_GATES_2025'));
  await page.waitForTimeout(900);
  const sv = await page.evaluate(() => {
    const s = nodes.find((n) => n.type === 'fead-solver');
    veFeadSolve(s.id);
    return s.id;
  });
  return { hatalar, sv };
}

test('çözücü penceresi → "Sonuçlar\'da aç" → FEAD sekmesi, başlangıç kartı sayfa boyu', async ({ page }) => {
  const { hatalar, sv } = await feadCoz(page);
  // Çözücü penceresini aç ve Sonuç sekmesine geç
  await page.evaluate((id) => {
    if (typeof clearSelection === 'function') clearSelection();
    addToSelection(nodes.find((n) => n.id === id));
    veTogglePropertiesPanel(true);
  }, sv);
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    // Sekme ADI kendi öğesinde: sekme 2026-09-26'dan beri adının altında
    // DURUMUNU da taşıyor, tüm metin artık yalnız "Sonuç" değil.
    const ad = (x) => (x.querySelector('.ve-fp-tab-ad') || x).textContent;
    const b = [...document.querySelectorAll('button, [role=tab]')].find((x) => /^\s*Sonuç\s*$/.test(ad(x)));
    if (b) b.click();
  });
  const ac = page.locator('.ve-fr-ac');
  await expect(ac).toBeVisible();
  await expect(page.locator('.ve-properties-content .ve-fr-kpi')).toHaveCount(10);
  await ac.click();
  await page.waitForTimeout(600);

  const olc = await page.evaluate(() => {
    const e = document.getElementById('ve-trace-empty');
    const ov = document.getElementById('ve-properties-overlay');
    return {
      sekme: veActiveSolverTabId,
      bosH: e.getBoundingClientRect().height,
      akis: getComputedStyle(e).justifyContent,
      kart: !!e.querySelector('.ve-fr-start'),
      kpi: e.querySelectorAll('.ve-fr-kpi').length,
      hazir: e.querySelectorAll('.ve-fr-preset').length,
      mufettis: ov ? getComputedStyle(ov).display : 'yok',
      eksenH: document.getElementById('ve-trace-axis').getBoundingClientRect().height
    };
  });
  expect(olc.sekme).toBe('fead');
  expect(olc.kart).toBe(true);
  expect(olc.kpi).toBe(10);
  expect(olc.hazir).toBe(6);
  // EKSEN TUVALİ YER YUTMAZ: 1000 px ekranda boş pano 800 px'ten büyük
  // (eski: 332 px — eksen tuvali 580 px'e ölçekleniyordu).
  expect(olc.eksenH).toBeLessThanOrEqual(40);
  expect(olc.bosH).toBeGreaterThan(800);
  // :has() kuralı: kart üstten akar
  expect(olc.akis).toBe('flex-start');
  expect(olc.mufettis).toBe('none');
  expect(hatalar).toEqual([]);
});

test('hazır diyagram GERÇEKTEN çizer; özet penceresi açılır ve kapanır', async ({ page }) => {
  const { hatalar } = await feadCoz(page);
  await page.evaluate(() => veFeadOpenResults());
  await page.waitForTimeout(500);
  await page.locator('.ve-fr-preset', { hasText: 'Campbell diyagramı' }).click();
  await page.waitForTimeout(400);
  const cizim = await page.evaluate(() => ({
    yuzey: getComputedStyle(document.getElementById('ve-trace-surface')).display,
    tuvalH: document.getElementById('ve-trace-canvas').getBoundingClientRect().height,
    bos: getComputedStyle(document.getElementById('ve-trace-empty')).display,
    not: getComputedStyle(document.getElementById('ve-trace-note')).display,
    notMetin: document.getElementById('ve-trace-note').innerText,
    eksen: veResultSlots[0].xAxis && veResultSlots[0].xAxis.id
  }));
  expect(cizim.yuzey).toBe('block');
  expect(cizim.tuvalH).toBeGreaterThan(300);
  expect(cizim.bos).toBe('none');
  expect(cizim.not).not.toBe('none');
  expect(cizim.notMetin).toMatch(/Campbell diyagramı/);
  expect(cizim.eksen).toBe('~fead-campbell:rpm');

  // Veri Gezgini: durum satırı ve özet kısayolu
  await expect(page.locator('#ve-results-tree .ve-fr-chip', { hasText: 'Güncel' })).toBeVisible();
  await page.locator('#ve-results-tree .ve-fr-tree-link', { hasText: 'FEAD Sonuç Özeti' }).click();
  const ov = page.locator('#ve-report-overlay');
  await expect(ov).toBeVisible();
  await expect(ov.locator('.ve-rep-head')).toHaveCount(1);
  await expect(ov.locator('.ve-fr-sec')).toHaveCount(await ov.locator('.ve-fr-sec').count());
  expect(await ov.locator('.ve-fr-sec').count()).toBeGreaterThanOrEqual(9);
  // Özet yatay taşmaz: geniş tablolar kendi kabında kayar
  const tasma = await page.evaluate(() => {
    const d = document.querySelector('.ve-fr-doc');
    return d.scrollWidth - d.clientWidth;
  });
  expect(tasma).toBeLessThanOrEqual(1);
  await ov.getByRole('button', { name: /Kapat/ }).click();
  await expect(ov).toBeHidden();
  expect(hatalar).toEqual([]);
});
