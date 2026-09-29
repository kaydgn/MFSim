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
 * SÜRÜCÜ KASNAĞIN penceresinin `showNodeProperties` ile kurulması ve
 * "Çevrim" sekmesindeki tablonun DOM'a basılması (2026-09-28'e kadar
 * Çözücü'nün panelindeydi).
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
  // BOŞ TOPOLOJİ SİHİRBAZLA KARŞILIYOR (2026-09-09): pencere zaten açık ve
  // `dblclick`i yutuyor — bu spec o gün sessizce öldü, 180 sn zaman aşımı.
  // Kapalıysa FEAD araçları penceresinin Sihirbaz'ı açar (kutusu yok, 2026-09-28).
  if (!(await page.locator('#ve-feadwiz-overlay').isVisible()))
    await page.click('#ve-fead-araclar .ve-fead-arac-govde [data-ey="sihirbaz"]');
  await expect(page.locator('#ve-feadwiz-overlay')).toBeVisible();
  await page.evaluate(() => veFeadWizGoto(4));
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
  await page.evaluate(() => { veFeadWizSeed('AG00976_GATES_2025'); veFeadWizGoto(4); });
  await page.waitForTimeout(600);
  const kwHam = await page.evaluate(() =>
    [...document.querySelectorAll('#ve-fw-body td.ve-fw-ro')].slice(0, 8).map((t) => t.textContent.trim()));
  console.log('SİHİRBAZ(kW okuma) ' + JSON.stringify(kwHam));
  expect(kwHam.filter((x) => x && x !== '—').length).toBeGreaterThan(0);

  // ── PANEL — SÜRÜCÜ KASNAĞIN PENCERESİ ──────────────────────────────────
  // Çevrim 2026-09-28'de Çözücü'den sürücü kasnağın "Çevrim" sekmesine
  // taşındı; veri çözücü düğümünde (işletme deposu) kalıyor. Tohum pencere
  // KURULURKEN atılır — boş modelde ilk kasnak sürücü yapılıp penceresi
  // açılınca tablo dolu gelmeli.
  await page.evaluate(() => veFeadWizClose(false));
  await page.waitForTimeout(300);
  const drvId = await page.evaluate(() => {
    const k = createNode('fead-crank', 300, 500);
    k.data.driver = true;
    clearSelection(); addToSelection(k); veTogglePropertiesPanel(true);
    return k.id;
  });
  await page.waitForTimeout(600);
  await page.click('.ve-fp-tab[data-k="cev"]');
  const p1 = await page.evaluate((id) => {
    const s = window.nodes.find((x) => x.type === 'fead-solver');
    const panel = document.getElementById('ve-fp-panes-' + id) || document.body;
    const pn = panel.querySelector('[data-k="cev"]');
    return { satir: s ? s.data.duty.length : -1, lib: s ? s.data.dutyLib : null,
             secici: !!(pn && pn.querySelector('select[onchange*="veFeadDutyLib"]')),
             gorunur: !!(pn && pn.offsetParent),
             tablo: pn ? pn.querySelectorAll('input[onchange*="veFeadDutySet"][onchange*=",\'rpm\',"]').length : 0,
             bosMesaj: panel.textContent.includes('Henüz devir noktası yok') };
  }, drvId);
  console.log('PANEL ' + JSON.stringify(p1));
  expect(p1.satir).toBeGreaterThan(0);
  expect(p1.tablo).toBe(p1.satir);
  expect(p1.secici).toBe(true);
  expect(p1.gorunur).toBe(true);
  expect(p1.bosMesaj).toBe(false);

  console.log('KONSOL ' + JSON.stringify(hatalar));
  expect(hatalar).toEqual([]);
});
