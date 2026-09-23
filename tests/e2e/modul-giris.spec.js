/**
 * modul-giris.spec.js — KARŞILAMA KARTINA TIKLAYINCA MODÜLÜN İÇİNE
 *
 * Kullanıcı isteği (2026-09-21): *"ana ekrandan FEAD modülüne tıkladıktan
 * sonra, direk program içine giriyor, yani güzel bir yükleme ekranı olur, ne
 * bileyim daha profesyonel bir görüntü olur."*
 *
 * NODE'DA ÖLÇÜLEMEZ, o yüzden burada: dizi gerçek `requestAnimationFrame`
 * üstünde yürüyor (jsdom'da hiç ilerlemez, birim kapısı onu stub'lıyor),
 * karşılama slaytının karesi `getComputedStyle` ile seçiliyor ve tıklamanın
 * kendisi gerçek bir kullanıcı olayı.
 *
 * Kapılananlar:
 *   1) Tıklama modülün İÇİNE kadar götürüyor (veFeadStack derinleşiyor) —
 *      eskiden kanvasta bir kart bırakıyor ve orada kalıyordu.
 *   2) Geçiş ekranı gerçekten görünüyor ve gerçekten kapanıyor.
 *   3) Doğrudan girişi OLMAYAN modülde davranış BİREBİR eski hâlinde.
 */
const { test, expect } = require('@playwright/test');
test.setTimeout(180000);

async function acilis(page) {
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await page.waitForFunction(
    () => typeof window.veStartModule === 'function'
      && typeof window.veModuleLoaderRun === 'function'
      && typeof window.veFeadOpenEditor === 'function',
    null, { timeout: 120000 });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none';
  }, null, { timeout: 120000 });
  await page.waitForSelector('.ve-module-card[data-module="fead-analysis"]');
}

test('FEAD kartı: geçiş ekranı görünüyor ve modülün İÇİNE giriliyor', async ({ page }) => {
  const hata = [];
  page.on('pageerror', (e) => hata.push(e.message));
  await acilis(page);

  await page.click('.ve-module-card[data-module="fead-analysis"]');

  // ── EKRAN GÖRÜNÜYOR ────────────────────────────────────────────────────
  const ekran = page.locator('#mfsim-module-loading');
  await expect(ekran).toBeVisible();
  const ilk = await page.evaluate(() => ({
    ad: document.getElementById('ve-modload-ad').textContent,
    alt: document.getElementById('ve-modload-alt').textContent,
    adim: document.querySelectorAll('#ve-modload-stages li').length,
    kademe: document.getElementById('mfsim-module-loading').style.getPropertyValue('--mfsim-kademe'),
    // Karşılama karesi DEVRALINDI: kartlar eriyip panel aynı fotoğrafın
    // üstünde beliriyor. Kare yoksa dize boş kalır ve ekran kâğıt zeminde
    // durur — o da geçerli, ama slayt koşarken kare OLMALI.
    foto: document.getElementById('ve-modload-photo').style.backgroundImage,
    ucus: document.querySelectorAll('.ve-welcome-flyer').length,
  }));
  expect(ilk.ad).toBe('FEAD');
  expect(ilk.alt).toContain('Kayış');
  expect(ilk.adim).toBe(3);
  expect(ilk.kademe).toBe('3');            // çentik sayısı adım listesinden
  expect(ilk.foto).toMatch(/url\(/);
  // Uçuş --z-widget, ekran --z-boot+1: görünmeyen bir animasyon kurulmuyor.
  expect(ilk.ucus).toBe(0);

  // ── KAPANIYOR VE İÇERİDEYİZ ────────────────────────────────────────────
  await expect(ekran).toBeHidden({ timeout: 15000 });
  const son = await page.evaluate(() => ({
    derinlik: (window.veFeadStack || []).length,
    tipler: window.nodes.map((n) => n.type).sort(),
    sihirbaz: getComputedStyle(document.getElementById('ve-feadwiz-overlay')).display,
    kaplamaYok: getComputedStyle(document.getElementById('mfsim-module-loading')).display,
  }));
  // ASIL KAPI: tıklama modülün İÇİNE kadar götürdü.
  expect(son.derinlik).toBe(1);
  // Açılış yüzeyi kuruldu (boş FEAD topolojisi sihirbazla karşılar):
  // sihirbaz + BOŞ Kayış Yolu kartı (Çizim Masası, 2026-09-23).
  expect(son.tipler).toEqual(['fead-layout', 'fead-wizard']);
  expect(son.sihirbaz).toBe('flex');
  expect(son.kaplamaYok).toBe('none');
  expect(hata).toEqual([]);
});

test('doğrudan girişi OLMAYAN modülde geçiş ekranı YOK, davranış eski', async ({ page }) => {
  await acilis(page);
  await page.click('.ve-module-card[data-module="arac-performans"]');

  // Ekran hiç açılmıyor: tip `moduleEnter` beyan etmiyor.
  await expect(page.locator('#mfsim-module-loading')).toBeHidden();
  const d = await page.evaluate(() => ({
    derinlik: (window.veAracStack || []).length,
    dugum: window.nodes.length,
    tip: window.nodes[0] && window.nodes[0].type,
  }));
  expect(d.derinlik).toBe(0);              // kök topolojide kalındı
  expect(d.dugum).toBe(1);
  expect(d.tip).toBe('arac-performans');
});
