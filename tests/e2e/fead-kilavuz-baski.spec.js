/**
 * fead-kilavuz-baski.spec.js — KILAVUZ ÇIKTI ALINIYOR
 *
 * Kullanıcı kararı (2026-09-21): *"Kullanıcı kılavuzunu genel olarak çıktı
 * alacağız. Çıktı alıp okuyacağız. Öyle değerlendireceğiz."*
 *
 * Belge artık programın gerçek bileşenlerini gömüyor ve o bileşenler EKRAN
 * için tasarlandı: tek satıra kurulmuş şeritler, sayfadan geniş tablolar,
 * kanvasın üstünde YÜZEN paneller. Hiçbiri Node'da ölçülemez — jsdom yerleşim
 * hesaplamıyor, `zoom` uygulamıyor, `@media print` bilmiyor. Bu dosya o
 * halkayı kapatıyor ve üç şeyi A4 genişliğinde, BASKI kipinde ölçüyor:
 *
 *   1. Hiçbir şekil sağdan taşmıyor  — taşan sütun çıktıda YOK demektir.
 *   2. Hiçbir şekil sayfadan uzun değil — uzun şekil ya kırpılır ya da kendi
 *      sayfasına atılıp orada yine taşar.
 *   3. Hiçbir şekil ÇÖKMÜŞ değil — akıştan çıkan bir parça hiçbir sınırı
 *      aşmaz, yalnız GÖRÜNMEZ olur; taşma ve yükseklik kapıları onu görmez.
 *   4. Hiçbir şekil ÖLÜ — belge bir kılavuz, program kopyası değil.
 *
 * Ölçülmüş kaçaklar (hepsi bu kapı kurulmadan önce canlıydı): Kayış Tablosu
 * 49 px taşıyordu (ölçek sahnenin kendi çerçevesini saymıyordu), katman
 * paneli `position:absolute` olduğu için 22 px'e çöküyordu, kasnak paneli
 * 1122 px ile sayfadan uzundu.
 */
const { test, expect } = require('@playwright/test');
test.setTimeout(180000);

const A4_EN = 794;          // 210 mm @ 96 dpi
const SAYFA_BOY = 1050;     // A4 içerik yüksekliği, kenar boşlukları düşülmüş
const EN_KISA = 40;         // bundan kısa bir şekil ÇÖKMÜŞ demektir
const PAY = 4;              // alt piksel yuvarlaması

test('FEAD kılavuzu A4 baskıda temiz', async ({ page }) => {
  await page.setViewportSize({ width: A4_EN, height: 1123 });
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await page.waitForFunction(() => typeof window.veGuideFeadHTML === 'function'
    && typeof window.veFeadExampleNodes === 'function', null, { timeout: 90000 });

  // Belge PROGRAMIN KENDİ üreticisinden — kılavuz nasıl üretiliyorsa öyle.
  const html = await page.evaluate(async () => {
    await new Promise((ok) => {
      if (window.FEAD_REPORT_TEMPLATE_B64 && window.MNT_REPORT_ASSETS) return ok();
      window.veGuideEnsureAssets ? window.veGuideEnsureAssets(ok) : ok();
    });
    return window.veGuideFeadHTML();
  });
  expect(html.length).toBeGreaterThan(50000);

  const sayfa = await page.context().newPage();
  await sayfa.setViewportSize({ width: A4_EN, height: 1123 });
  await sayfa.setContent(html, { waitUntil: 'load' });
  await sayfa.emulateMedia({ media: 'print' });
  await sayfa.waitForTimeout(500);

  const olcum = await sayfa.evaluate(() => {
    const out = { sahne: 0, tasan: [], uzun: [], canli: 0, odaklanir: 0 };
    document.querySelectorAll('.gk-sahne').forEach((sc, i) => {
      out.sahne++;
      const cs = getComputedStyle(sc);
      const kutu = sc.getBoundingClientRect();
      const sag = kutu.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth);
      let tas = 0;
      sc.querySelectorAll('*').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > sag) tas = Math.max(tas, Math.round(r.right - sag));
      });
      if (tas > 0) out.tasan.push({ no: i + 1, px: tas });
      out.uzun.push({ no: i + 1, px: Math.round(kutu.height) });
      // ÖLÜ MÜ: fare kesilmiş ve klavye sırasından çıkarılmış olmalı.
      if (getComputedStyle(sc).pointerEvents !== 'none') out.canli++;
      sc.querySelectorAll('input,select,button,textarea,a').forEach((el) => {
        if (el.getAttribute('tabindex') !== '-1') out.odaklanir++;
      });
    });
    return out;
  });

  expect(olcum.sahne).toBeGreaterThan(10);
  // 1 — hiçbir şekil sağdan taşmıyor
  expect(olcum.tasan.filter((t) => t.px > PAY)).toEqual([]);
  // 2 — hiçbir şekil sayfadan uzun değil
  expect(olcum.uzun.filter((u) => u.px > SAYFA_BOY)).toEqual([]);
  // 3 — hiçbir şekil ÇÖKMÜŞ değil. Katman paneli kanvasın üstünde yüzmek için
  // `position:absolute`; sahnede saracak bir kutu olmadığı için akıştan
  // çıkıyor ve şekil 22 px'e iniyordu — hiçbir sınırı aşmadan, GÖRÜNMEDEN.
  expect(olcum.uzun.filter((u) => u.px < EN_KISA)).toEqual([]);
  // 4 — hiçbir şekil canlı değil
  expect(olcum.canli).toBe(0);
  expect(olcum.odaklanir).toBe(0);

  await sayfa.close();
});
