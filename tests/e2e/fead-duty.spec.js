/**
 * fead-duty.spec.js — ÇALIŞMA ÇEVRİMİ OTOMATİK GELİR (gerçek tarayıcı)
 *
 * Kullanıcı bildirimi (2026-08-31): *"Motor ve Çevrim kısmında aksesuar
 * seçtiğimizde çalışma çevrimini otomatik olarak hesaplamıyor. El ile girmek
 * gerekiyor. Bu olmamalı."*
 *
 * Birim testler kütüphaneyi ve iki köprüyü Node'da doğruluyor. Buradaki soru
 * başka: YÜZEY ayakta mı? Node'da HİÇ koşmayan halkalar — modal kabuğunun
 * gerçekten açılması, açılır pencereden GERÇEK seçim (`selectOption`),
 * panelin `showNodeProperties` ile kurulması ve tablonun DOM'a basılması.
 *
 * Panel tarafı ayrıca önemli: kusur sihirbazda bildirildi ama asıl modelin
 * yaşadığı yerde de vardı ve orası yalnız tarayıcıda kuruluyor.
 */
const { test, expect } = require('@playwright/test');
test.setTimeout(180000);

async function bootApp(page) {
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' && typeof window.veFeadOpenEditor === 'function' &&
    typeof window.veFeadWizOpen === 'function' && Array.isArray(window.nodes), null, { timeout: 90000 });
  await page.evaluate(() => { if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans'); });
  await page.waitForFunction(() => { const s = document.getElementById('mfsim-loading-screen'); return !s || s.style.display === 'none'; }, null, { timeout: 90000 });
}

test('çalışma çevrimi otomatik gelir — sihirbaz ve panel', async ({ page }) => {
  const hatalar = []; page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);
  await page.evaluate(() => { const n = createNode('fead-analysis', 400, 300); veFeadOpenEditor(n.id); });
  await page.waitForTimeout(500);

  // ── SİHİRBAZ ────────────────────────────────────────────────────────────
  const id = await page.evaluate(() => window.nodes.find((x) => x.type === 'fead-wizard').id);
  await page.dblclick('#' + id);
  await page.evaluate(() => veFeadWizGoto(5));
  await page.waitForTimeout(600);

  const w1 = await page.evaluate(() => ({
    satir: veFeadWizState().solver.duty.length,
    lib: veFeadWizState().solver.dutyLib,
    kart: !!document.querySelector('#ve-fw-body .ve-fw-card'),
    secici: !!document.querySelector('#ve-fw-body select[onchange*="veFeadWizDutyLib"]'),
    devir: [...document.querySelectorAll('#ve-fw-body table tbody tr')].length,
  }));
  console.log('SİHİRBAZ(taze) ' + JSON.stringify(w1));
  expect(w1.satir).toBeGreaterThan(0);
  expect(w1.secici).toBe(true);

  // Gerçek seçim: açılır pencereden başka bir çevrim
  const sec = page.locator('#ve-fw-body select[onchange*="veFeadWizDutyLib"]');
  await sec.selectOption('AG00902-4');
  await page.waitForTimeout(500);
  const w2 = await page.evaluate(() => veFeadWizState().solver.duty.map((r) => r.rpm));
  console.log('SİHİRBAZ(seçim) ' + JSON.stringify(w2));
  expect(w2).toEqual([700, 1200, 2000, 3000]);

  // Örnek + aksesuar modeli → kW otomatik
  await page.evaluate(() => { veFeadWizSeed('AG00976_GATES_2025'); veFeadWizGoto(5); });
  await page.waitForTimeout(600);
  const kwHam = await page.evaluate(() =>
    [...document.querySelectorAll('#ve-fw-body td.ve-fw-ro')].slice(0, 8).map((t) => t.textContent.trim()));
  console.log('SİHİRBAZ(kW okuma) ' + JSON.stringify(kwHam));
  expect(kwHam.filter((x) => x && x !== '—').length).toBeGreaterThan(0);

  // ── PANEL ───────────────────────────────────────────────────────────────
  await page.evaluate(() => veFeadWizClose(false));
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    // Çözücü düğümü kanvasta yoksa kur — panelin kendi yolu ölçülecek.
    let s = window.nodes.find((x) => x.type === 'fead-solver');
    if (!s) s = createNode('fead-solver', 300, 500);
    showNodeProperties(s);
  });
  await page.waitForTimeout(600);
  const p1 = await page.evaluate(() => {
    const s = window.nodes.find((x) => x.type === 'fead-solver');
    const panel = document.querySelector('.ve-properties') || document.body;
    return { satir: s ? s.data.duty.length : -1, lib: s ? s.data.dutyLib : null,
             secici: !!panel.querySelector('select[onchange*="veFeadDutyLib"]'),
             bosMesaj: panel.textContent.includes('Henüz devir noktası yok') };
  });
  console.log('PANEL ' + JSON.stringify(p1));
  expect(p1.satir).toBeGreaterThan(0);
  expect(p1.secici).toBe(true);
  expect(p1.bosMesaj).toBe(false);

  console.log('KONSOL ' + JSON.stringify(hatalar));
  expect(hatalar).toEqual([]);
});
